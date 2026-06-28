import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

from config import PRICE_DROP_ALERT, YIELD_DROP_ALERT, EX_DIV_DAYS_AHEAD, TIMEZONE

log = logging.getLogger(__name__)

MYT = timezone(timedelta(hours=8))

# In-memory store for previous prices/yields — used for drop comparison
_prev_prices: dict[str, float] = {}
_prev_yields: dict[str, float] = {}


def is_market_hours() -> bool:
    now = datetime.now(MYT)
    if now.weekday() >= 5:
        return False
    return 9 <= now.hour < 17


def check_price_drop(holdings_data: dict, notifier) -> list[dict]:
    """Alert if any holding drops 5%+ since last check or below avg_price threshold."""
    triggered = []
    for name, h in holdings_data.items():
        price = h.get('current_price')
        if not price:
            continue

        avg_price = h.get('avg_price', 0)
        prev      = _prev_prices.get(name)

        # Alert: current price 5%+ below avg_price (only if user holds units)
        if avg_price > 0 and h.get('units', 0) > 0:
            drop_from_avg = (avg_price - price) / avg_price
            if drop_from_avg >= PRICE_DROP_ALERT:
                alert = {
                    'name':     name,
                    'price':    price,
                    'avg_price':avg_price,
                    'drop_pct': drop_from_avg * 100,
                    'div_yield':h.get('div_yield', 0),
                }
                triggered.append(alert)
                notifier.send_price_alert(name, drop_from_avg * 100, price, h.get('div_yield', 0))

        # Alert: price dropped 5%+ since last hourly check
        elif prev and prev > 0:
            drop_since_last = (prev - price) / prev
            if drop_since_last >= PRICE_DROP_ALERT:
                alert = {
                    'name':     name,
                    'price':    price,
                    'prev':     prev,
                    'drop_pct': drop_since_last * 100,
                    'div_yield':h.get('div_yield', 0),
                }
                triggered.append(alert)
                notifier.send_price_alert(name, drop_since_last * 100, price, h.get('div_yield', 0))

        _prev_prices[name] = price

    return triggered


def check_ex_dividend(holdings_data: dict, notifier) -> list[dict]:
    """Alert if ex-dividend date is within EX_DIV_DAYS_AHEAD days."""
    triggered = []
    now = datetime.now(timezone.utc)

    for name, h in holdings_data.items():
        ex_date: Optional[datetime] = h.get('ex_date')
        if not ex_date:
            continue

        if ex_date.tzinfo is None:
            ex_date = ex_date.replace(tzinfo=timezone.utc)

        days_until = (ex_date - now).days
        if 0 <= days_until <= EX_DIV_DAYS_AHEAD:
            units      = h.get('units', 0)
            annual_div = h.get('annual_div', 0)
            # Estimate quarterly payout
            est_payout = units * annual_div / 4 if annual_div > 0 else 0.0
            alert = {
                'name':       name,
                'ex_date':    ex_date,
                'days_until': days_until,
                'payout':     est_payout,
                'annual_div': annual_div,
            }
            triggered.append(alert)
            notifier.send_dividend_alert(name, ex_date, annual_div / 4, est_payout)

    return triggered


def check_yield_drop(holdings_data: dict, notifier) -> list[dict]:
    """Alert if yield dropped more than YIELD_DROP_ALERT percentage points since last check."""
    triggered = []
    for name, h in holdings_data.items():
        current_yield = h.get('div_yield', 0)
        prev_yield    = _prev_yields.get(name)

        if prev_yield is not None and prev_yield > 0:
            drop = prev_yield - current_yield
            if drop >= YIELD_DROP_ALERT:
                alert = {
                    'name':         name,
                    'prev_yield':   prev_yield,
                    'current_yield':current_yield,
                    'drop':         drop,
                }
                triggered.append(alert)
                log.warning(
                    '%s yield dropped %.2f%% → %.2f%% (drop: %.3f%%)',
                    name, prev_yield * 100, current_yield * 100, drop * 100
                )

        _prev_yields[name] = current_yield

    return triggered
