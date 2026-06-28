import logging
import sys
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('investment_agent.log'),
    ],
)

log = logging.getLogger(__name__)

from config import MY_HOLDINGS, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
from telegram_utils import send_message
from scheduler import create_scheduler
import notifier


def verify_telegram() -> bool:
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        log.warning('Telegram not configured — check .env')
        return False
    ok = send_message('🔌 Investment Agent: Telegram connection verified')
    if ok:
        log.info('Telegram verified')
    else:
        log.warning('Telegram ping failed — messages will not be delivered')
    return ok


def main():
    log.info('Investment Monitoring Agent starting')

    verify_telegram()
    notifier.send_startup(MY_HOLDINGS)

    scheduler = create_scheduler()
    log.info('Scheduler created. Jobs: %s', [job.id for job in scheduler.get_jobs()])

    try:
        scheduler.start()
    except (KeyboardInterrupt, SystemExit):
        scheduler.shutdown()
        send_message('🛑 Investment Agent stopped.')
        log.info('Agent stopped')


if __name__ == '__main__':
    main()
