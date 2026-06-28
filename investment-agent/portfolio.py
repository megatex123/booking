import logging
from fetcher import fetch_all_holdings
from config import TARGET_MONTHLY_INCOME

log = logging.getLogger(__name__)


def generate_report(holdings_data: dict) -> dict:
    total_cost    = 0.0
    total_value   = 0.0
    total_annual  = 0.0
    holdings_list = list(holdings_data.values())

    for h in holdings_list:
        total_cost   += h['cost_basis']
        total_value  += h['market_value']
        total_annual += h['annual_income']

    total_monthly  = total_annual / 12
    total_gl       = total_value - total_cost
    total_gl_pct   = (total_gl / total_cost * 100) if total_cost > 0 else 0.0
    progress_pct   = (total_monthly / TARGET_MONTHLY_INCOME * 100) if TARGET_MONTHLY_INCOME > 0 else 0.0

    return {
        'holdings':            holdings_list,
        'total_cost':          total_cost,
        'total_value':         total_value,
        'total_gain_loss':     total_gl,
        'total_gain_loss_pct': total_gl_pct,
        'total_annual_income': total_annual,
        'total_monthly_income':total_monthly,
        'target_monthly':      TARGET_MONTHLY_INCOME,
        'progress_pct':        progress_pct,
    }


def get_portfolio_summary() -> dict:
    holdings_data = fetch_all_holdings()
    return generate_report(holdings_data)


def get_portfolio_value(holdings_data: dict) -> float:
    return sum(h['market_value'] for h in holdings_data.values())


def get_monthly_income(holdings_data: dict) -> float:
    return sum(h['monthly_income'] for h in holdings_data.values())


def get_progress_to_target(monthly_income: float) -> float:
    if not TARGET_MONTHLY_INCOME:
        return 0.0
    return monthly_income / TARGET_MONTHLY_INCOME * 100


def get_unrealized_gain(holdings_data: dict) -> float:
    return sum(h['gain_loss'] for h in holdings_data.values())
