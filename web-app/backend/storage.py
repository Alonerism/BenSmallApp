"""
Supabase storage module for file persistence and user management.
Handles template files, output history, and authentication.
"""
import os
from datetime import datetime
from typing import Optional, List, Dict, Any
from io import BytesIO

from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

# Supabase configuration
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")

# Storage bucket names
TEMPLATES_BUCKET = "templates"
OUTPUTS_BUCKET = "outputs"

# File categories for templates
TEMPLATE_CATEGORIES = {
    "weekly_template": "Weekly Timesheet Template",
    "cash_template": "Cash Template",
    "payroll_template": "Payroll Template",
    "reimb_template": "Reimbursements & Bonus Template",
    "loans_template": "Loans Template"
}

# Cached client
_client: Optional[Client] = None


def get_client() -> Optional[Client]:
    """Get Supabase client if configured."""
    global _client
    if not SUPABASE_URL or not SUPABASE_KEY:
        return None
    if _client is None:
        _client = create_client(SUPABASE_URL, SUPABASE_KEY)
    return _client


def is_configured() -> bool:
    """Check if Supabase is configured."""
    return bool(SUPABASE_URL and SUPABASE_KEY)


# =============================================================================
# Template Files (Persistent/Consistent Files)
# =============================================================================

async def upload_template(
    category: str,
    filename: str,
    file_bytes: bytes,
    content_type: str = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
) -> Dict[str, Any]:
    """Upload or replace a template file."""
    client = get_client()
    if not client:
        return {"error": "Supabase not configured", "success": False}

    try:
        # Delete existing file for this category first
        existing = await list_templates()
        for tmpl in existing.get("templates", []):
            if tmpl.get("category") == category:
                path = tmpl.get("path")
                if path:
                    try:
                        client.storage.from_(TEMPLATES_BUCKET).remove([path])
                    except:
                        pass

        # Upload new file
        path = f"{category}/{filename}"
        client.storage.from_(TEMPLATES_BUCKET).upload(
            path,
            file_bytes,
            {"content-type": content_type, "upsert": "true"}
        )

        # Store metadata in database
        client.table("template_files").upsert({
            "category": category,
            "filename": filename,
            "path": path,
            "uploaded_at": datetime.now().isoformat(),
            "size_bytes": len(file_bytes)
        }, on_conflict="category").execute()

        return {
            "success": True,
            "path": path,
            "category": category,
            "filename": filename
        }
    except Exception as e:
        return {"error": str(e), "success": False}


async def get_template(category: str) -> Optional[Dict[str, Any]]:
    """Get a template file by category."""
    client = get_client()
    if not client:
        return None

    try:
        result = client.table("template_files").select("*").eq("category", category).single().execute()
        if result.data:
            path = result.data.get("path")
            file_data = client.storage.from_(TEMPLATES_BUCKET).download(path)
            return {
                "filename": result.data.get("filename"),
                "category": category,
                "bytes": file_data,
                "uploaded_at": result.data.get("uploaded_at")
            }
    except Exception as e:
        print(f"Error getting template: {e}")
    return None


async def list_templates() -> Dict[str, Any]:
    """List all template files."""
    client = get_client()
    if not client:
        return {"templates": [], "configured": False}

    try:
        result = client.table("template_files").select("*").execute()
        templates = []
        for row in result.data or []:
            templates.append({
                "category": row.get("category"),
                "category_label": TEMPLATE_CATEGORIES.get(row.get("category"), row.get("category")),
                "filename": row.get("filename"),
                "path": row.get("path"),
                "uploaded_at": row.get("uploaded_at"),
                "size_bytes": row.get("size_bytes")
            })
        return {"templates": templates, "configured": True}
    except Exception as e:
        return {"templates": [], "error": str(e), "configured": True}


async def delete_template(category: str) -> Dict[str, Any]:
    """Delete a template file."""
    client = get_client()
    if not client:
        return {"error": "Supabase not configured", "success": False}

    try:
        result = client.table("template_files").select("path").eq("category", category).single().execute()
        if result.data:
            path = result.data.get("path")
            client.storage.from_(TEMPLATES_BUCKET).remove([path])
            client.table("template_files").delete().eq("category", category).execute()
            return {"success": True}
        return {"error": "Template not found", "success": False}
    except Exception as e:
        return {"error": str(e), "success": False}


# =============================================================================
# Output History (Processed Files)
# =============================================================================

async def save_output(
    output_type: str,
    filename: str,
    file_bytes: bytes,
    week_of: Optional[str] = None,
    metadata: Optional[Dict] = None
) -> Dict[str, Any]:
    """Save a processed output file to history."""
    client = get_client()
    if not client:
        return {"error": "Supabase not configured", "success": False}

    try:
        date_str = datetime.now().strftime("%Y/%m")
        path = f"{output_type}/{date_str}/{filename}"

        client.storage.from_(OUTPUTS_BUCKET).upload(
            path,
            file_bytes,
            {"content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}
        )

        client.table("output_files").insert({
            "output_type": output_type,
            "filename": filename,
            "path": path,
            "created_at": datetime.now().isoformat(),
            "week_of": week_of,
            "size_bytes": len(file_bytes),
            "metadata": metadata or {}
        }).execute()

        return {"success": True, "path": path, "filename": filename}
    except Exception as e:
        return {"error": str(e), "success": False}


async def list_outputs(
    output_type: Optional[str] = None,
    limit: int = 50,
    offset: int = 0
) -> Dict[str, Any]:
    """List output files with optional filtering."""
    client = get_client()
    if not client:
        return {"outputs": [], "configured": False}

    try:
        query = client.table("output_files").select("*").order("created_at", desc=True)
        if output_type:
            query = query.eq("output_type", output_type)
        query = query.range(offset, offset + limit - 1)

        result = query.execute()
        outputs = []
        for row in result.data or []:
            outputs.append({
                "id": row.get("id"),
                "output_type": row.get("output_type"),
                "filename": row.get("filename"),
                "path": row.get("path"),
                "created_at": row.get("created_at"),
                "week_of": row.get("week_of"),
                "size_bytes": row.get("size_bytes"),
                "metadata": row.get("metadata")
            })

        return {"outputs": outputs, "configured": True}
    except Exception as e:
        return {"outputs": [], "error": str(e), "configured": True}


async def get_output(output_id: int) -> Optional[Dict[str, Any]]:
    """Get an output file by ID."""
    client = get_client()
    if not client:
        return None

    try:
        result = client.table("output_files").select("*").eq("id", output_id).single().execute()
        if result.data:
            path = result.data.get("path")
            file_data = client.storage.from_(OUTPUTS_BUCKET).download(path)
            return {
                "filename": result.data.get("filename"),
                "output_type": result.data.get("output_type"),
                "bytes": file_data,
                "created_at": result.data.get("created_at"),
                "week_of": result.data.get("week_of")
            }
    except Exception as e:
        print(f"Error getting output: {e}")
    return None


async def delete_output(output_id: int) -> Dict[str, Any]:
    """Delete an output file."""
    client = get_client()
    if not client:
        return {"error": "Supabase not configured", "success": False}

    try:
        result = client.table("output_files").select("path").eq("id", output_id).single().execute()
        if result.data:
            path = result.data.get("path")
            client.storage.from_(OUTPUTS_BUCKET).remove([path])
            client.table("output_files").delete().eq("id", output_id).execute()
            return {"success": True}
        return {"error": "Output not found", "success": False}
    except Exception as e:
        return {"error": str(e), "success": False}
