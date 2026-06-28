import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

from telegram_utils import send_message

log = logging.getLogger(__name__)

MYT = timezone(timedelta(hours=8))
SEP = '─' * 21


def _fmt_price(price: Optional[float]) -> str:
    return f'RM{price:.4f}' if price else 'N/A'


def _fmt_change(pct: Optional[float]) -> str:
    if pct is None:
        return ''
    sign = '+' if pct >= 0 else ''
    return f' ({sign}{pct:.2f}%)'


def send_daily_report(report: dict) -> None:
    now   = datetime.now(MYT).strftime('%Y-%m-%d %H:%M MYT')
    lines = [f'📊 Daily Portfolio Report', f'{SEP}']

    for h in report['holdings']:
        price  = h.get('current_price')
        change = h.get('daily_change')
        lines.append(f"💼 {h['name']}: {_fmt_price(price)}{_fmt_change(change)}")

    lines += [
        SEP,
        f"💰 Portfolio: RM{report['total_value']:.2f}",
        f"📈 Monthly Income: RM{report['total_monthly_income']:.2f}",
        f"🎯 Target Progress: {report['progress_pct']:.1f}%",
        SEP,
    ]

    # Next ex-dividend
    upcoming = [
        (h['name'], h['ex_date'])
        for h in report['holdings']
        if h.get('ex_date')
    ]
    if upcoming:
        upcoming.sort(key=lambda x: x[1])
        name, ex_date = upcoming[0]
        if ex_date.tzinfo is None:
            ex_date = ex_date.replace(tzinfo=timezone.utc)
        days = (ex_date - datetime.now(timezone.utc)).days
        lines.append(f'📅 Next dividend: {name} in {days} days')
    else:
        lines.append('📅 Next dividend: — ')

    lines.append('🌐 dashboard.percubaan.com')

    send_message('\n'.join(lines))


def send_price_alert(reit: str, drop_pct: float, price: float, div_yield: float) -> None:
    msg = (
        f'⚠️ Price Alert — {reit}\n'
        f'{SEP}\n'
        f'📉 Drop: -{drop_pct:.2f}%\n'
        f'💰 Current: RM{price:.4f}\n'
        f'📊 Yield: {div_yield * 100:.2f}%\n'
        f'🌐 dashboard.percubaan.com'
    )
    send_message(msg)


def send_dividend_alert(reit: str, ex_date: datetime, amount_per_unit: float, your_payout: float) -> None:
    if ex_date.tzinfo is None:
        ex_date = ex_date.replace(tzinfo=timezone.utc)
    days  = (ex_date - datetime.now(timezone.utc)).days
    dstr  = ex_date.strftime('%Y-%m-%d')
    msg = (
        f'💵 Dividend Alert — {reit}\n'
        f'{SEP}\n'
        f'📅 Ex-date: {dstr} (in {days} days)\n'
        f'💰 Per unit: RM{amount_per_unit:.4f}\n'
        f'💼 Your payout: RM{your_payout:.2f}\n'
        f'🌐 dashboard.percubaan.com'
    )
    send_message(msg)


def send_weekly_summary(report: dict) -> None:
    lines = [
        '📊 Weekly Portfolio Summary',
        SEP,
        f"💼 Portfolio Value: RM{report['total_value']:.2f}",
        f"📈 Total G/L: RM{report['total_gain_loss']:+.2f} ({report['total_gain_loss_pct']:+.1f}%)",
        f"💰 Monthly Income: RM{report['total_monthly_income']:.2f}",
        f"🎯 Progress: {report['progress_pct']:.1f}% of RM{report['target_monthly']:.0f}/month",
        SEP,
    ]
    for h in report['holdings']:
        lines.append(
            f"  {h['name']}: {_fmt_price(h.get('current_price'))} "
            f"| Yield {h['div_yield'] * 100:.2f}% "
            f"| RM{h['monthly_income']:.2f}/mo"
        )
    lines.append('🌐 dashboard.percubaan.com')
    send_message('\n'.join(lines))


def send_purchase_confirmation(reit: str, units: int, price: float, total_cost: float) -> None:
    msg = (
        f'✅ Purchase Confirmed — {reit}\n'
        f'{SEP}\n'
        f'📦 Units: {units:,}\n'
        f'💰 Price: RM{price:.4f}\n'
        f'💳 Total Cost: RM{total_cost:.2f}\n'
        f'🌐 dashboard.percubaan.com'
    )
    send_message(msg)


def send_startup(holdings: dict) -> None:
    names = ', '.join(holdings.keys())
    msg = (
        f'🤖 Investment Agent Online\n'
        f'{SEP}\n'
        f'📊 Tracking: {names}\n'
        f'🎯 Target: RM200/month\n'
        f'⏰ Daily report: 8:00am KL time\n'
        f'🌐 dashboard.percubaan.com'
    )
    send_message(msg)
