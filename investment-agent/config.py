import os
from dotenv import load_dotenv

load_dotenv()

MY_HOLDINGS = {
    'IGB REIT': {
        'code': '5227.KL',
        'units': 0,
        'avg_price': 0,
    },
    'Sunway REIT': {
        'code': '5176.KL',
        'units': 0,
        'avg_price': 0,
    },
    'Axis REIT': {
        'code': '5106.KL',
        'units': 0,
        'avg_price': 0,
    },
}

TARGET_MONTHLY_INCOME = float(os.getenv('TARGET_MONTHLY_INCOME', '200'))

PRICE_DROP_ALERT  = 0.05   # alert if price drops 5%+ below avg_price
YIELD_DROP_ALERT  = 0.005  # alert if yield drops 0.5 percentage points
EX_DIV_DAYS_AHEAD = 7      # alert if ex-dividend within 7 days

MARKET_OPEN  = '09:00'
MARKET_CLOSE = '17:00'
TIMEZONE     = 'Asia/Kuala_Lumpur'

TELEGRAM_BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN', '')
TELEGRAM_CHAT_ID   = os.getenv('TELEGRAM_CHAT_ID', '')

OBSIDIAN_LOG_PATH = '/home/penyahpepijat/claude/obsidian/AI-Dev-Agent/investment-log.md'
