"""
Full Week Processor - Wraps Trump24 for full week time activity processing.
Processes an entire week's Time Activity Report and fills the weekly timesheet.
"""
from datetime import datetime
from typing import Dict, Any, Optional

from config import get_settings, AppSettings
from .trump24 import run_time_to_weekly


class FullWeekProcessor:
    """Process full week time activity reports using Trump24 logic."""

    def __init__(self, settings: Optional[AppSettings] = None):
        self.settings = settings or get_settings()

    def process(self, time_data_bytes: bytes, weekly_template_bytes: bytes) -> Dict[str, Any]:
        """
        Process full week of Time Activity Report data.

        Args:
            time_data_bytes: Time Activity Report Excel file bytes (with multiple days)
            weekly_template_bytes: Weekly Timesheet template Excel file bytes

        Returns:
            Dictionary with processing results and output file bytes
        """
        s = self.settings

        # Run the actual Trump24 processor with settings
        result = run_time_to_weekly(
            raw_times_bytes=time_data_bytes,
            weekly_template_bytes=weekly_template_bytes,
            round_to_hours=s.rounding.round_to,
            reg_cap=s.hours.daily_reg_cap,
            daily_max_hours=s.hours.daily_max,
            long_stint_flag=s.hours.long_stint_flag,
            match_min_score=s.matching.strict_score,
            fallback_score=s.matching.fallback_score,
            flag_low_weekday=s.hours.flag_low_weekday,
            suggest_lunch_deduct=s.hours.suggest_lunch_deduct,
            save=True,
        )

        # Build match results from name matching dataframe
        match_results = []
        if not result.name_matching.empty:
            for _, row in result.name_matching.iterrows():
                match_results.append({
                    "tar_name": row.get("TAR Name", ""),
                    "weekly_name": row.get("Weekly Match", ""),
                    "score": int(row.get("Score", 0)),
                    "needs_review": row.get("Flag", "") == "REVIEW"
                })

        # Build anomalies from review dataframe
        anomalies = []
        if not result.review_df.empty:
            for _, row in result.review_df.iterrows():
                reasons = row.get("Reasons", "")
                if reasons:
                    anomalies.append({
                        "date": row.get("Date", ""),
                        "name": row.get("Weekly_Name", "") or row.get("TAR_Name", ""),
                        "reasons": reasons,
                        "raw_hours": row.get("RawHours", ""),
                        "rounded_hours": row.get("RoundedHours", ""),
                        "suggested": row.get("SuggestedHours", "")
                    })

        # Find unmatched names
        unmatched = [r["tar_name"] for r in match_results if not r["weekly_name"]]

        # Calculate week range from daily_long dates
        week_range = "Unknown"
        if not result.daily_long.empty and "Date" in result.daily_long.columns:
            dates = result.daily_long["Date"].unique()
            if len(dates) > 0:
                dates_sorted = sorted(dates)
                start_date = dates_sorted[0]
                end_date = dates_sorted[-1]
                if hasattr(start_date, 'strftime'):
                    week_range = f"{start_date.strftime('%m/%d')} - {end_date.strftime('%m/%d/%Y')}"
                else:
                    week_range = f"{start_date} - {end_date}"

        # Count unique employees
        employees_processed = 0
        if not result.daily_long.empty and "Employee" in result.daily_long.columns:
            employees_processed = result.daily_long["Employee"].nunique()

        # Count days in data
        days_in_data = 0
        if not result.daily_long.empty and "Date" in result.daily_long.columns:
            days_in_data = result.daily_long["Date"].nunique()

        return {
            "week_range": week_range,
            "employees_processed": employees_processed,
            "days_in_data": days_in_data,
            "cells_filled": result.filled_cells,
            "match_results": match_results,
            "anomalies": anomalies,
            "unmatched": unmatched,
            "output_bytes": result.output_bytes,
            "secretary_message": result.secretary_message
        }
