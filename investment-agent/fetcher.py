import logging
import time
from datetime import datetime, timezone, timedelta
from typing import Optional

import pandas as pd
import yfinance as yf

from config import MY_HOLDINGS

log = logging.getLogger(__name__)

CACHE_TTL = 15 * 60  # 15 minutes

_price_cache:   dict[str, tuple[Optional[float], float]] = {}
_div_cache:     dict[str, tuple[float, float]]           = {}
_exdiv_cache:   dict[str, tuple[Optional[datetime], float]] = {}
_change_cache:  dict[str, tuple[Optional[float], float]] = {}


def _ticker(code: str) -> yf.Ticker:
    return yf.Ticker(code)


def get_price(code: str) -> Optional[float]:
    now = time.time()
    if code in _price_cache:
        val, ts = _price_cache[code]
        if now - ts < CACHE_TTL:
            return val
    try:
        info  = _ticker(code).fast_info
        price = info.get('last_price') or info.get('previous_close')
        _price_cache[code] = (price, now)
        return price
    except Exception as e:
        log.error('Error fetching price for %s: %s', code, e)
        return None


def get_daily_change(code: str) -> Optional[float]:
    """Returns % change vs previous close, e.g. 1.23 means +1.23%."""
    now = time.time()
    if code in _change_cache:
        val, ts = _change_cache[code]
        if now - ts < CACHE_TTL:
            return val
    try:
        info  = _ticker(code).fast_info
        last  = info.get('last_price')
        prev  = info.get('previous_close')
        pct   = ((last - prev) / prev * 100) if last and prev and prev != 0 else None
        _change_cache[code] = (pct, now)
        return pct
    except Exception as e:
        log.error('Error fetching daily change for %s: %s', code, e)
        return None


def get_annual_dividends(code: str) -> float:
    now = time.time()
    if code in _div_cache:
        val, ts = _div_cache[code]
        if now - ts < CACHE_TTL:
            return val
    try:
        divs = _ticker(code).dividends
        if divs.empty:
            _div_cache[code] = (0.0, now)
            return 0.0
        if divs.index.tz is None:
            divs.index = divs.index.tz_localize('UTC')
        cutoff   = pd.Timestamp.now(tz='UTC') - pd.DateOffset(years=1)
        trailing = float(divs[divs.index > cutoff].sum())
        _div_cache[code] = (trailing, now)
        return trailing
    except Exception as e:
        log.error('Error fetching dividends for %s: %s', code, e)
        return 0.0


def get_next_ex_dividend(code: str) -> Optional[datetime]:
    now = time.time()
    if code in _exdiv_cache:
        val, ts = _exdiv_cache[code]
        if now - ts < CACHE_TTL:
            return val
    try:
        cal    = _ticker(code).calendar
        result = None
        if isinstance(cal, dict):
            raw = cal.get('Ex-Dividend Date') or cal.get('Dividend Date')
            if raw is not None:
                result = pd.Timestamp(raw).to_pydatetime()
        _exdiv_cache[code] = (result, now)
        return result
    except Exception as e:
        log.error('Error fetching ex-dividend date for %s: %s', code, e)
        return None


def calculate_yield(price: Optional[float], annual_dividend: float) -> float:
    if not price or price == 0:
        return 0.0
    return annual_dividend / price


def get_all_prices(holdings: dict) -> dict:
    """Return {name: price} for all holdings."""
    result = {}
    for name, h in holdings.items():
        result[name] = get_price(h['code'])
        time.sleep(0.3)
    return result


def fetch_all_holdings() -> dict:
    """Enrich MY_HOLDINGS with live market data. Returns enriched dict."""
    enriched = {}
    for name, h in MY_HOLDINGS.items():
        code          = h['code']
        price         = get_price(code)
        daily_chg     = get_daily_change(code)
        annual_div    = get_annual_dividends(code)
        div_yield     = calculate_yield(price, annual_div)
        ex_date       = get_next_ex_dividend(code)

        units         = h['units']
        avg_price     = h['avg_price']
        cost_basis    = units * avg_price
        market_value  = units * (price or 0)
        gain_loss     = market_value - cost_basis
        gain_loss_pct = (gain_loss / cost_basis * 100) if cost_basis > 0 else 0.0
        annual_income = units * annual_div
        monthly_income= annual_income / 12

        enriched[name] = {
            **h,
            'name':           name,
            'current_price':  price,
            'daily_change':   daily_chg,
            'annual_div':     annual_div,
            'div_yield':      div_yield,
            'ex_date':        ex_date,
            'cost_basis':     cost_basis,
            'market_value':   market_value,
            'gain_loss':      gain_loss,
            'gain_loss_pct':  gain_loss_pct,
            'annual_income':  annual_income,
            'monthly_income': monthly_income,
        }
        time.sleep(0.3)
    return enriched
