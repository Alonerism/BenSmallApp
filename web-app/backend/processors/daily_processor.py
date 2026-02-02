"""
Daily Processor - Wraps Trump20 for daily time activity processing.
Processes a single day's Time Activity Report and fills the corresponding day in WeeklyTime.
"""
from datetime import datetime
from typing import Dict, Any, Optional

from config import get_settings, AppSettings
from .trump20 import run_trump20_daily


class DailyProcessor:
    """Process daily time activity reports using Trump20 logic."""

    def __init__(self, settings: Optional[AppSettings] = None):
        self.settings = settings or get_settings()

    def process(self, tar_bytes: bytes, weekly_bytes: bytes) -> Dict[str, Any]:
        """
        Process a single day's Time Activity Report.

        Args:
            tar_bytes: Time Activity Report Excel file bytes
            weekly_bytes: Weekly Timesheet template Excel file bytes

        Returns:
            Dictionary with processing results and output file bytes
        """
        s = self.settings

        # Run the actual Trump20 processor with settings
        result = run_trump20_daily(
            raw_times_bytes=tar_bytes,
            weekly_template_bytes=weekly_bytes,
            round_to_hours=s.rounding.round_to,
            reg_cap=s.hours.daily_reg_cap,
            daily_max_hours=s.hours.daily_max,
            long_stint_flag=s.hours.long_stint_flag,
            match_min_score=s.matching.strict_score,
            fallback_score=s.matching.fallback_score,
            flag_low_weekday=s.hours.flag_low_weekday,
            suggest_lunch_deduct=s.hours.suggest_lunch_deduct,
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

        # Build daily totals
        daily_totals = {}
        if not result.daily_long.empty:
            for _, row in result.daily_long.iterrows():
                emp = row.get("Employee", "")
                if emp:
                    daily_totals[emp] = {
                        "raw": float(row.get("RawHours", 0)),
                        "rounded": float(row.get("RoundedHours", 0))
                    }

        # Find unmatched names
        unmatched = [r["tar_name"] for r in match_results if not r["weekly_name"]]

        return {
            "date": result.report_date.strftime("%m/%d/%Y"),
            "day_of_week": result.report_date.strftime("%A"),
            "match_results": match_results,
            "anomalies": anomalies,
            "daily_totals": daily_totals,
            "unmatched": unmatched,
            "processed_count": result.filled_cells // 2,  # Reg+OT per person
            "output_bytes": result.output_bytes,
            "secretary_message": result.secretary_message
        }
