"""
Weekly Processor - Wraps Trump28 for weekly hours to Cash & Payroll processing.
Processes filled weekly timesheet into Cash and Payroll reports.
"""
from datetime import datetime
from typing import Dict, Any, Optional, List

from config import get_settings, AppSettings
from .trump28 import run_pipeline


class WeeklyProcessor:
    """Process weekly hours into Cash and Payroll reports using Trump28 logic."""

    def __init__(self, settings: Optional[AppSettings] = None):
        self.settings = settings or get_settings()

    def process(
        self,
        weekly_bytes: bytes,
        cash_bytes: bytes,
        payroll_bytes: bytes,
        reimb_bytes: bytes,
        loans_bytes: Optional[bytes] = None
    ) -> Dict[str, Any]:
        """
        Process weekly hours into Cash and Payroll reports.

        Args:
            weekly_bytes: Filled weekly timesheet Excel file bytes
            cash_bytes: Cash template Excel file bytes
            payroll_bytes: Payroll template Excel file bytes
            reimb_bytes: Reimbursements & Bonus Excel file bytes
            loans_bytes: Optional Loans Excel file bytes

        Returns:
            Dictionary with processing results and output file bytes
        """
        s = self.settings

        # Run the actual Trump28 processor
        result = run_pipeline(
            weekly_bytes=weekly_bytes,
            cash_bytes=cash_bytes,
            payroll_bytes=payroll_bytes,
            reimb_bytes=reimb_bytes,
            loans_bytes=loans_bytes,
            save=True,
        )

        # Build match results for preview
        match_results = []
        for report in result.unmatched_reports:
            match_results.append({
                "weekly_name": report.get("name", ""),
                "missing_in": report.get("missing", []),
                "needs_review": True
            })

        # Build bonus summary
        bonus_summary = []
        if result.bonus_summary:
            bs = result.bonus_summary
            if bs.get("num_foremen", 0) > 0:
                bonus_summary.append({
                    "type": "Foreman Bonus",
                    "count": bs["num_foremen"],
                    "total_yards": bs["total_yards"]
                })
            if bs.get("delfern_yards", 0) > 0:
                bonus_summary.append({
                    "type": "Delfern Yards",
                    "yards": bs["delfern_yards"]
                })

        # Date suffix for filenames
        date_suffix = datetime.now().strftime(s.output.date_format)

        # Build cash preview (simplified)
        cash_preview: List[Dict] = []

        # Build payroll preview (simplified)
        payroll_preview: List[Dict] = []

        return {
            "date_suffix": date_suffix,
            "match_results": match_results,
            "cash_preview": cash_preview,
            "payroll_preview": payroll_preview,
            "bonus_summary": bonus_summary,
            "loan_notes": result.loan_notes,
            "reimbursements": {},
            "unmatched": [r.get("name", "") for r in result.unmatched_reports],
            "total_yards": result.bonus_summary.get("total_yards", 0),
            "delfern_yards": result.bonus_summary.get("delfern_yards", 0),
            "cash_filename": f"{s.output.cash_prefix}{date_suffix}.xlsx",
            "payroll_filename": f"{s.output.payroll_prefix}{date_suffix}.xlsx",
            "cash_bytes": result.cash_output_bytes,
            "payroll_bytes": result.payroll_output_bytes,
            "loans_bytes": result.loans_output_bytes,
            "counts": result.counts
        }
