import logging
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo

from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.cron import CronTrigger

import notifier
from alerts import check_price_drop, check_ex_dividend, check_yield_drop
from portfolio import get_portfolio_summary
from obsidian_logger import log_daily_snapshot

log    = logging.getLogger(__name__)
MYT_TZ = ZoneInfo('Asia/Kuala_Lumpur')


def job_daily_report():
    try:
        log.info('Running daily report')
        report = get_portfolio_summary()
        notifier.send_daily_report(report)
    except Exception as e:
        log.error('Daily report failed: %s', e)


def job_hourly_price_alerts():
    try:
        log.info('Running hourly price check')
        report = get_portfolio_summary()
        # Build holdings_data dict keyed by name from report holdings list
        holdings_data = {h['name']: h for h in report['holdings']}
        check_price_drop(holdings_data, notifier)
        check_yield_drop(holdings_data, notifier)
    except Exception as e:
        log.error('Hourly price alert failed: %s', e)


def job_ex_dividend_check():
    try:
        log.info('Running ex-dividend check')
        report = get_portfolio_summary()
        holdings_data = {h['name']: h for h in report['holdings']}
        check_ex_dividend(holdings_data, notifier)
    except Exception as e:
        log.error('Ex-dividend check failed: %s', e)


def job_weekly_summary():
    try:
        log.info('Running weekly summary')
        report = get_portfolio_summary()
        notifier.send_weekly_summary(report)
    except Exception as e:
        log.error('Weekly summary failed: %s', e)


def job_midnight_snapshot():
    try:
        log.info('Running midnight Obsidian snapshot')
        report = get_portfolio_summary()
        date   = datetime.now(timezone(timedelta(hours=8))).strftime('%Y-%m-%d')
        log_daily_snapshot(date, report)
    except Exception as e:
        log.error('Midnight snapshot failed: %s', e)


def create_scheduler() -> BlockingScheduler:
    scheduler = BlockingScheduler(timezone=MYT_TZ)

    # 8:00am daily — portfolio report to Telegram
    scheduler.add_job(
        job_daily_report,
        CronTrigger(hour=8, minute=0, timezone=MYT_TZ),
        id='daily_report', replace_existing=True,
    )

    # Every hour 9am–5pm Mon–Fri — price drop + yield drop check
    scheduler.add_job(
        job_hourly_price_alerts,
        CronTrigger(hour='9-17', minute=0, day_of_week='mon-fri', timezone=MYT_TZ),
        id='hourly_price_alerts', replace_existing=True,
    )

    # Monday 8:00am — ex-dividend date check
    scheduler.add_job(
        job_ex_dividend_check,
        CronTrigger(day_of_week='mon', hour=8, minute=0, timezone=MYT_TZ),
        id='ex_dividend_check', replace_existing=True,
    )

    # Sunday 8:00am — weekly summary
    scheduler.add_job(
        job_weekly_summary,
        CronTrigger(day_of_week='sun', hour=8, minute=0, timezone=MYT_TZ),
        id='weekly_summary', replace_existing=True,
    )

    # Midnight daily — snapshot to Obsidian
    scheduler.add_job(
        job_midnight_snapshot,
        CronTrigger(hour=0, minute=0, timezone=MYT_TZ),
        id='midnight_snapshot', replace_existing=True,
    )

    return scheduler
