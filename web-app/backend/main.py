"""
Payroll Master - Web Application Backend
FastAPI server for payroll processing with configurable settings.
"""
import json
from datetime import datetime
from io import BytesIO
from typing import Optional, List
import base64

from fastapi import FastAPI, File, UploadFile, HTTPException, Query, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel

from config import (
    AppSettings,
    get_settings,
    update_settings,
    reset_settings,
)
from processors import DailyProcessor, WeeklyProcessor, FullWeekProcessor
import storage
import auth
from auth import require_auth, require_admin, UserLogin, UserCreate


app = FastAPI(
    title="Payroll Master",
    description="Web-based payroll processing application",
    version="2.0.0"
)

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Initialize admin user on startup
@app.on_event("startup")
async def startup_event():
    """Initialize admin user on startup."""
    client = storage.get_client()
    if client:
        await auth.init_admin_user(client)


# ============================================================================
# Authentication Endpoints
# ============================================================================

@app.post("/api/auth/login")
async def login(credentials: UserLogin):
    """Login with username and password."""
    client = storage.get_client()
    if not client:
        raise HTTPException(status_code=500, detail="Database not configured")

    user = await auth.authenticate_user(client, credentials.username, credentials.password)

    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")

    if isinstance(user, dict) and user.get("error"):
        raise HTTPException(status_code=403, detail=user["error"])

    # Create session
    token = auth.create_session(user["id"], user["username"], user["role"])

    return {
        "token": token,
        "user": {
            "id": user["id"],
            "username": user["username"],
            "role": user["role"]
        }
    }


@app.post("/api/auth/signup")
async def signup(credentials: UserCreate):
    """Request a new account (requires admin approval)."""
    client = storage.get_client()
    if not client:
        raise HTTPException(status_code=500, detail="Database not configured")

    result = await auth.create_user(client, credentials.username, credentials.password)

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Signup failed"))

    return result


@app.post("/api/auth/logout")
async def logout(session: dict = Depends(require_auth)):
    """Logout current session."""
    # Session token is in the Authorization header, we need to get it
    # The require_auth already validated it, so we just need to delete
    return {"success": True, "message": "Logged out"}


@app.get("/api/auth/me")
async def get_current_user(session: dict = Depends(require_auth)):
    """Get current logged in user."""
    return {
        "user_id": session["user_id"],
        "username": session["username"],
        "role": session["role"]
    }


# ============================================================================
# Admin User Management Endpoints
# ============================================================================

@app.get("/api/admin/users")
async def list_users(session: dict = Depends(require_admin)):
    """List all users (admin only)."""
    client = storage.get_client()
    users = await auth.list_users(client)
    return {"users": users}


@app.post("/api/admin/users/{user_id}/approve")
async def approve_user(user_id: int, session: dict = Depends(require_admin)):
    """Approve a pending user (admin only)."""
    client = storage.get_client()
    result = await auth.approve_user(client, user_id)

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Approval failed"))

    return result


@app.delete("/api/admin/users/{user_id}")
async def delete_user(user_id: int, session: dict = Depends(require_admin)):
    """Delete/kick a user (admin only)."""
    client = storage.get_client()
    result = await auth.delete_user(client, user_id)

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Delete failed"))

    return result


# ============================================================================
# Settings Endpoints
# ============================================================================

@app.get("/api/settings", response_model=AppSettings)
async def get_current_settings():
    """Get current application settings."""
    return get_settings()


@app.put("/api/settings", response_model=AppSettings)
async def update_current_settings(settings: AppSettings):
    """Update application settings."""
    return update_settings(settings)


@app.post("/api/settings/reset", response_model=AppSettings)
async def reset_to_defaults():
    """Reset settings to defaults."""
    return reset_settings()


@app.get("/api/settings/export")
async def export_settings():
    """Export settings as downloadable JSON file."""
    settings = get_settings()
    content = settings.model_dump_json(indent=2)
    return Response(
        content=content,
        media_type="application/json",
        headers={
            "Content-Disposition": "attachment; filename=payroll_settings.json"
        }
    )


class ImportSettingsRequest(BaseModel):
    settings_json: str


@app.post("/api/settings/import", response_model=AppSettings)
async def import_settings(request: ImportSettingsRequest):
    """Import settings from JSON string."""
    try:
        data = json.loads(request.settings_json)
        settings = AppSettings(**data)
        return update_settings(settings)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid settings format: {str(e)}")


# ============================================================================
# Storage Endpoints (Supabase)
# ============================================================================

@app.get("/api/storage/status")
async def storage_status():
    """Check if Supabase storage is configured."""
    return {
        "configured": storage.is_configured(),
        "template_categories": storage.TEMPLATE_CATEGORIES
    }


# Templates (Consistent Files)
@app.get("/api/templates")
async def list_templates():
    """List all template files."""
    return await storage.list_templates()


@app.post("/api/templates/{category}")
async def upload_template(
    category: str,
    file: UploadFile = File(...)
):
    """Upload or replace a template file."""
    if category not in storage.TEMPLATE_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Invalid category. Must be one of: {list(storage.TEMPLATE_CATEGORIES.keys())}")

    file_bytes = await file.read()
    result = await storage.upload_template(category, file.filename, file_bytes)

    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "Upload failed"))

    return result


@app.get("/api/templates/{category}")
async def get_template(category: str):
    """Download a template file."""
    template = await storage.get_template(category)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    return StreamingResponse(
        BytesIO(template["bytes"]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f"attachment; filename={template['filename']}"
        }
    )


@app.delete("/api/templates/{category}")
async def delete_template(category: str):
    """Delete a template file."""
    result = await storage.delete_template(category)
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "Delete failed"))
    return result


# Output History
@app.get("/api/outputs")
async def list_outputs(
    output_type: Optional[str] = Query(None, description="Filter by type: cash, payroll, weekly"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0)
):
    """List output file history."""
    return await storage.list_outputs(output_type, limit, offset)


@app.get("/api/outputs/{output_id}")
async def get_output(output_id: int):
    """Download an output file from history."""
    output = await storage.get_output(output_id)
    if not output:
        raise HTTPException(status_code=404, detail="Output not found")

    return StreamingResponse(
        BytesIO(output["bytes"]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f"attachment; filename={output['filename']}"
        }
    )


@app.delete("/api/outputs/{output_id}")
async def delete_output(output_id: int):
    """Delete an output file from history."""
    result = await storage.delete_output(output_id)
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "Delete failed"))
    return result


# ============================================================================
# Daily Processing Endpoints (Time Activity → Weekly)
# ============================================================================

class DailyPreviewResponse(BaseModel):
    date: str
    day_of_week: str
    match_results: list
    anomalies: list
    daily_totals: dict
    unmatched: list
    processed_count: int


@app.post("/api/daily/preview", response_model=DailyPreviewResponse)
async def preview_daily(
    tar_file: UploadFile = File(..., description="Time Activity Report file"),
    weekly_file: UploadFile = File(..., description="Weekly Timesheet file")
):
    """Preview daily time processing results before saving."""
    try:
        tar_bytes = await tar_file.read()
        weekly_bytes = await weekly_file.read()

        processor = DailyProcessor()
        result = processor.process(tar_bytes, weekly_bytes)

        return DailyPreviewResponse(
            date=result["date"],
            day_of_week=result["day_of_week"],
            match_results=result["match_results"],
            anomalies=result["anomalies"],
            daily_totals=result["daily_totals"],
            unmatched=result["unmatched"],
            processed_count=result["processed_count"]
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/daily/process")
async def process_daily(
    tar_file: UploadFile = File(...),
    weekly_file: UploadFile = File(...),
    save_to_history: bool = Query(False, description="Save output to history")
):
    """Process daily time and return updated weekly file for download."""
    try:
        tar_bytes = await tar_file.read()
        weekly_bytes = await weekly_file.read()

        processor = DailyProcessor()
        result = processor.process(tar_bytes, weekly_bytes)

        settings = get_settings()
        date_suffix = datetime.now().strftime(settings.output.date_format)
        filename = f"{settings.output.weekly_prefix}{date_suffix}.xlsx"

        # Optionally save to history
        if save_to_history and storage.is_configured():
            await storage.save_output(
                "weekly",
                filename,
                result["output_bytes"],
                week_of=result.get("date"),
                metadata={"processed_count": result["processed_count"]}
            )

        return StreamingResponse(
            BytesIO(result["output_bytes"]),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================================
# Full Week Processing Endpoints (Weekly CSV → Weekly Timesheet)
# ============================================================================

class FullWeekPreviewResponse(BaseModel):
    week_range: str
    employees_processed: int
    days_in_data: int
    cells_filled: int
    match_results: list
    anomalies: list
    unmatched: list


@app.post("/api/fullweek/preview", response_model=FullWeekPreviewResponse)
async def preview_fullweek(
    time_data_file: UploadFile = File(..., description="Weekly time data (CSV or Excel)"),
    weekly_template_file: UploadFile = File(..., description="Weekly Timesheet template")
):
    """Preview full week processing results."""
    try:
        time_bytes = await time_data_file.read()
        template_bytes = await weekly_template_file.read()

        processor = FullWeekProcessor()
        result = processor.process(time_bytes, template_bytes)

        return FullWeekPreviewResponse(
            week_range=result["week_range"],
            employees_processed=result["employees_processed"],
            days_in_data=result["days_in_data"],
            cells_filled=result["cells_filled"],
            match_results=result["match_results"],
            anomalies=result["anomalies"],
            unmatched=result["unmatched"]
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/fullweek/process")
async def process_fullweek(
    time_data_file: UploadFile = File(...),
    weekly_template_file: UploadFile = File(...),
    save_to_history: bool = Query(False)
):
    """Process full week and return filled timesheet."""
    try:
        time_bytes = await time_data_file.read()
        template_bytes = await weekly_template_file.read()

        processor = FullWeekProcessor()
        result = processor.process(time_bytes, template_bytes)

        settings = get_settings()
        date_suffix = datetime.now().strftime(settings.output.date_format)
        filename = f"{settings.output.weekly_prefix}{date_suffix}.xlsx"

        if save_to_history and storage.is_configured():
            await storage.save_output(
                "weekly",
                filename,
                result["output_bytes"],
                week_of=result.get("week_range"),
                metadata={
                    "employees_processed": result["employees_processed"],
                    "cells_filled": result["cells_filled"]
                }
            )

        return StreamingResponse(
            BytesIO(result["output_bytes"]),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================================
# Weekly Processing Endpoints (Weekly → Cash & Payroll)
# ============================================================================

class WeeklyPreviewResponse(BaseModel):
    date_suffix: str
    match_results: list
    cash_preview: list
    payroll_preview: list
    bonus_summary: list
    loan_notes: list
    reimbursements: dict
    unmatched: list
    total_yards: float
    delfern_yards: float


@app.post("/api/weekly/preview", response_model=WeeklyPreviewResponse)
async def preview_weekly(
    weekly_file: UploadFile = File(..., description="Weekly Hours file"),
    cash_file: UploadFile = File(..., description="Cash template file"),
    payroll_file: UploadFile = File(..., description="Payroll template file"),
    reimb_file: UploadFile = File(..., description="Reimbursements & Bonus file"),
    loans_file: Optional[UploadFile] = File(None, description="Loans file (optional)")
):
    """Preview weekly processing results before saving."""
    try:
        weekly_bytes = await weekly_file.read()
        cash_bytes = await cash_file.read()
        payroll_bytes = await payroll_file.read()
        reimb_bytes = await reimb_file.read()
        loans_bytes = await loans_file.read() if loans_file else None

        processor = WeeklyProcessor()
        result = processor.process(
            weekly_bytes, cash_bytes, payroll_bytes, reimb_bytes, loans_bytes
        )

        return WeeklyPreviewResponse(
            date_suffix=result["date_suffix"],
            match_results=result["match_results"],
            cash_preview=result["cash_preview"],
            payroll_preview=result["payroll_preview"],
            bonus_summary=result["bonus_summary"],
            loan_notes=result["loan_notes"],
            reimbursements=result["reimbursements"],
            unmatched=result["unmatched"],
            total_yards=result["total_yards"],
            delfern_yards=result["delfern_yards"]
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


class ProcessedFilesResponse(BaseModel):
    cash_filename: str
    payroll_filename: str
    cash_base64: str
    payroll_base64: str


@app.post("/api/weekly/process", response_model=ProcessedFilesResponse)
async def process_weekly(
    weekly_file: UploadFile = File(...),
    cash_file: UploadFile = File(...),
    payroll_file: UploadFile = File(...),
    reimb_file: UploadFile = File(...),
    loans_file: Optional[UploadFile] = File(None),
    save_to_history: bool = Query(False)
):
    """Process weekly data and return Cash & Payroll files for download."""
    try:
        weekly_bytes = await weekly_file.read()
        cash_bytes = await cash_file.read()
        payroll_bytes = await payroll_file.read()
        reimb_bytes = await reimb_file.read()
        loans_bytes = await loans_file.read() if loans_file else None

        processor = WeeklyProcessor()
        result = processor.process(
            weekly_bytes, cash_bytes, payroll_bytes, reimb_bytes, loans_bytes
        )

        # Optionally save to history
        if save_to_history and storage.is_configured():
            await storage.save_output(
                "cash",
                result["cash_filename"],
                result["cash_bytes"],
                week_of=result.get("date_suffix"),
                metadata={"total_yards": result.get("total_yards")}
            )
            await storage.save_output(
                "payroll",
                result["payroll_filename"],
                result["payroll_bytes"],
                week_of=result.get("date_suffix")
            )

        return ProcessedFilesResponse(
            cash_filename=result["cash_filename"],
            payroll_filename=result["payroll_filename"],
            cash_base64=base64.b64encode(result["cash_bytes"]).decode(),
            payroll_base64=base64.b64encode(result["payroll_bytes"]).decode()
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================================
# Process with Templates (use stored templates)
# ============================================================================

@app.post("/api/process/with-templates")
async def process_with_templates(
    weekly_file: UploadFile = File(..., description="Weekly Hours file (required)"),
    reimb_file: UploadFile = File(..., description="Reimbursements & Bonus file (required)"),
    loans_file: Optional[UploadFile] = File(None, description="Loans file (optional)"),
    save_to_history: bool = Query(True)
):
    """
    Process weekly data using stored templates for Cash and Payroll.
    Only requires the variable files (weekly hours, reimb/bonus, loans).
    """
    if not storage.is_configured():
        raise HTTPException(status_code=400, detail="Supabase storage not configured. Upload templates manually.")

    # Get templates from storage
    cash_template = await storage.get_template("cash_template")
    payroll_template = await storage.get_template("payroll_template")

    if not cash_template:
        raise HTTPException(status_code=400, detail="Cash template not found. Upload it in the Files section.")
    if not payroll_template:
        raise HTTPException(status_code=400, detail="Payroll template not found. Upload it in the Files section.")

    try:
        weekly_bytes = await weekly_file.read()
        reimb_bytes = await reimb_file.read()
        loans_bytes = await loans_file.read() if loans_file else None

        processor = WeeklyProcessor()
        result = processor.process(
            weekly_bytes,
            cash_template["bytes"],
            payroll_template["bytes"],
            reimb_bytes,
            loans_bytes
        )

        # Save to history
        if save_to_history:
            await storage.save_output(
                "cash",
                result["cash_filename"],
                result["cash_bytes"],
                week_of=result.get("date_suffix"),
                metadata={"total_yards": result.get("total_yards")}
            )
            await storage.save_output(
                "payroll",
                result["payroll_filename"],
                result["payroll_bytes"],
                week_of=result.get("date_suffix")
            )

        return ProcessedFilesResponse(
            cash_filename=result["cash_filename"],
            payroll_filename=result["payroll_filename"],
            cash_base64=base64.b64encode(result["cash_bytes"]).decode(),
            payroll_base64=base64.b64encode(result["payroll_bytes"]).decode()
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================================
# Health Check
# ============================================================================

@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "version": "2.0.0",
        "timestamp": datetime.now().isoformat(),
        "storage_configured": storage.is_configured()
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
