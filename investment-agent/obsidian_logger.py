import logging
import os
from datetime import datetime, timezone, timedelta

from config import OBSIDIAN_LOG_PATH

log = logging.getLogger(__name__)

MYT = timezone(timedelta(hours=8))


def _ensure_file() -> None:
    os.makedirs(os.path.dirname(OBSIDIAN_LOG_PATH), exist_ok=True)
    if not os.path.exists(OBSIDIAN_LOG_PATH):
        with open(OBSIDIAN_LOG_PATH, 'w', encoding='utf-8') as f:
            f.write(
                '# Investment Log\n\n'
                '## Goal: RM200/month passive income for server costs\n'
                '## Strategy: Bursa Malaysia REITs — IGB, Sunway, Axis\n'
                f'## Started: {datetime.now(MYT).strftime("%Y-%m-%d")}\n'
                '## Holdings: (updated by agent)\n'
                '## Daily Snapshots: (updated by agent)\n'
                '## Dividend History: (updated by agent)\n'
                '## Purchase Log: (updated by agent)\n\n'
                '---\n\n'
            )


def _append(text: str) -> None:
    _ensure_file()
    try:
        with open(OBSIDIAN_LOG_PATH, 'a', encoding='utf-8') as f:
            f.write(text)
    except Exception as e:
        log.error('Failed to write to Obsidian log: %s', e)


def log_daily_snapshot(date: str, report: dict) -> None:
    rows = []
    for h in report['holdings']:
        price = f"{h['current_price']:.4f}" if h.get('current_price') else 'N/A'
        rows.append(
            f"| {h['name']} | {price} | {h['div_yield'] * 100:.2f}% "
            f"| {h['monthly_income']:.2f} | {h['gain_loss_pct']:+.1f}% |"
        )

    table = '\n'.join([
        '| REIT | Price (RM) | Yield | Monthly Income (RM) | G/L % |',
        '|------|-----------|-------|---------------------|-------|',
        *rows,
    ])

    _append(
        f'\n## Daily Snapshot — {date}\n\n'
        f'{table}\n\n'
        f'**Portfolio Value:** RM{report["total_value"]:.2f}  \n'
        f'**Monthly Income:** RM{report["total_monthly_income"]:.2f}  \n'
        f'**Progress:** {report["progress_pct"]:.1f}%  \n\n'
        f'---\n'
    )


def log_dividend_received(reit: str, amount: float, date: str) -> None:
    _append(
        f'\n## Dividend Received — {date}\n\n'
        f'- **REIT:** {reit}\n'
        f'- **Amount:** RM{amount:.2f}\n\n'
        f'---\n'
    )


def log_purchase(reit: str, units: int, price: float, date: str) -> None:
    total = units * price
    _append(
        f'\n## Purchase — {date}\n\n'
        f'- **REIT:** {reit}\n'
        f'- **Units:** {units:,}\n'
        f'- **Price:** RM{price:.4f}\n'
        f'- **Total Cost:** RM{total:.2f}\n\n'
        f'---\n'
    )
