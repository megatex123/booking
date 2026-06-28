import logging
import requests
from config import TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID

logger = logging.getLogger(__name__)

_API_BASE = "https://api.telegram.org/bot{token}/{method}"


def send_message(text: str) -> bool:
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        logger.warning("Telegram not configured — skipping message: %s", text[:80])
        return False
    try:
        url = _API_BASE.format(token=TELEGRAM_BOT_TOKEN, method="sendMessage")
        resp = requests.post(
            url,
            json={"chat_id": TELEGRAM_CHAT_ID, "text": text},
            timeout=10,
        )
        if not resp.ok:
            logger.error("Telegram API error %s: %s", resp.status_code, resp.text[:200])
            return False
        return True
    except Exception as e:
        logger.error("Failed to send Telegram message: %s", e)
        return False


def send_alert(text: str) -> bool:
    return send_message(f"[ALERT] {text}")
