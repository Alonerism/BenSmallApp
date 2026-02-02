"""
Application configuration with all adjustable settings.
These can be modified via the settings panel in the frontend.
"""
from pydantic import BaseModel, Field
from typing import Dict, List, Optional


class RoundingSettings(BaseModel):
    """Settings for hour rounding"""
    round_to: float = Field(0.5, description="Round hours to nearest increment (e.g., 0.5 = 30 min, 0.25 = 15 min)")
    round_mode: str = Field("nearest", description="Rounding mode: 'nearest', 'up', 'down'")
    special_rules: bool = Field(True, description="Enable special rounding rules (e.g., 8:00-8:25 rounds to 8:00)")
    special_threshold_minutes: int = Field(25, description="Minutes threshold for special rounding rule")


class HourCapSettings(BaseModel):
    """Settings for hour caps and limits"""
    daily_regular_cap: float = Field(8.0, description="Max regular hours per day before OT")
    weekly_ot_threshold: float = Field(40.0, description="Weekly hours before overtime kicks in")
    payroll_sick_ceiling: float = Field(24.0, description="Max hours payroll covers after sick time")
    daily_max_sanity: float = Field(16.0, description="Max plausible hours per day (sanity check)")


class HoursSettings(BaseModel):
    """Settings for hour processing (used by Trump processors)"""
    daily_reg_cap: float = Field(8.0, description="Max regular hours per day before OT")
    daily_max: float = Field(16.0, description="Max plausible hours per day (sanity check)")
    long_stint_flag: float = Field(10.0, description="Flag single stints longer than this")
    flag_low_weekday: float = Field(2.0, description="Flag weekday shifts shorter than this")
    suggest_lunch_deduct: float = Field(0.5, description="Suggested lunch deduction for long shifts")


class MatchingSettings(BaseModel):
    """Settings for fuzzy name matching"""
    strict_score: int = Field(92, ge=50, le=100, description="Primary match threshold (higher = stricter)")
    fallback_score: int = Field(85, ge=50, le=100, description="Fallback match threshold for last-name matching")
    bonus_match_score: int = Field(90, ge=50, le=100, description="Match threshold for bonus recipients")


class FlaggingSettings(BaseModel):
    """Settings for flagging anomalies"""
    long_shift_hours: float = Field(10.0, description="Flag shifts longer than this")
    short_weekday_hours: float = Field(2.0, description="Flag weekday shifts shorter than this")
    suggest_lunch_deduct: float = Field(0.5, description="Suggested lunch deduction for long shifts")


class BonusSettings(BaseModel):
    """Settings for bonus calculations"""
    foreman_enabled: bool = Field(True, description="Enable foreman bonus")
    foreman_formula: str = Field("(total_yards / num_foremen) * (uploads_score / 10)", description="Foreman bonus formula")
    triple_multiplier: float = Field(3.0, description="Multiplier for 3x bonus")
    half_multiplier: float = Field(0.5, description="Multiplier for 0.5x bonus")
    standard_multiplier: float = Field(1.0, description="Multiplier for 1x bonus")
    uploads_max_score: int = Field(10, description="Maximum uploads score")


class EmployeeTypeSettings(BaseModel):
    """Settings for employee type categorization"""
    type_a_description: str = Field("Full Payroll: regular → payroll, OT → cash", description="Type A employees")
    type_b_description: str = Field("All Cash: regular capped at 40, overflow + OT → cash OT", description="Type B employees")
    type_c_description: str = Field("Split: payroll capped at 24 after sick, rest → cash", description="Type C employees")
    type_c_payroll_cap: float = Field(24.0, description="Payroll cap for Type C employees")
    type_b_weekly_cap: float = Field(40.0, description="Weekly regular cap for Type B before OT")


class LoanSettings(BaseModel):
    """Settings for loan processing"""
    enabled: bool = Field(True, description="Enable loan processing")
    auto_deduct: bool = Field(True, description="Automatically deduct loan payments from cash")
    prevent_negative: bool = Field(True, description="Never deduct more than available cash")
    move_paid_to_history: bool = Field(True, description="Move fully-paid loans to history sheet")


class OutputSettings(BaseModel):
    """Settings for output files"""
    date_format: str = Field("%m.%d.%y", description="Date format for file naming (MM.DD.YY)")
    cash_prefix: str = Field("Cash_Filled_", description="Prefix for cash output files")
    payroll_prefix: str = Field("Payroll_Filled_", description="Prefix for payroll output files")
    weekly_prefix: str = Field("Weekly_Updated_", description="Prefix for weekly output files")


class AppSettings(BaseModel):
    """Main application settings container"""
    rounding: RoundingSettings = Field(default_factory=RoundingSettings)
    hour_caps: HourCapSettings = Field(default_factory=HourCapSettings)
    hours: HoursSettings = Field(default_factory=HoursSettings)
    matching: MatchingSettings = Field(default_factory=MatchingSettings)
    flagging: FlaggingSettings = Field(default_factory=FlaggingSettings)
    bonuses: BonusSettings = Field(default_factory=BonusSettings)
    employee_types: EmployeeTypeSettings = Field(default_factory=EmployeeTypeSettings)
    loans: LoanSettings = Field(default_factory=LoanSettings)
    output: OutputSettings = Field(default_factory=OutputSettings)


# Global settings instance (can be updated via API)
_current_settings = AppSettings()


def get_settings() -> AppSettings:
    """Get current settings"""
    return _current_settings


def update_settings(new_settings: AppSettings) -> AppSettings:
    """Update settings"""
    global _current_settings
    _current_settings = new_settings
    return _current_settings


def reset_settings() -> AppSettings:
    """Reset to default settings"""
    global _current_settings
    _current_settings = AppSettings()
    return _current_settings
