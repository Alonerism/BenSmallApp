"""Payroll processors module.

Provides processor wrappers that use the original Trump file logic:
- DailyProcessor: Wraps Trump20 for daily time activity processing
- FullWeekProcessor: Wraps Trump24 for full week processing
- WeeklyProcessor: Wraps Trump28 for weekly → Cash & Payroll processing
"""
from .daily_processor import DailyProcessor
from .weekly_processor import WeeklyProcessor
from .fullweek_processor import FullWeekProcessor

# Also expose the raw Trump functions for direct access if needed
from .trump20 import run_trump20_daily, Trump20Result
from .trump24 import run_time_to_weekly, TimeToWeeklyResult
from .trump28 import run_pipeline, Trump28Result

__all__ = [
    "DailyProcessor",
    "WeeklyProcessor",
    "FullWeekProcessor",
    "run_trump20_daily",
    "run_time_to_weekly",
    "run_pipeline",
    "Trump20Result",
    "TimeToWeeklyResult",
    "Trump28Result",
]
