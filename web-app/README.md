# Payroll Master - Web Application

A modern web-based payroll processing application with file persistence and configurable settings.

## Features

### Processing Modes

1. **Full Week Processing** (NEW)
   - Process an entire week of time data at once from CSV or Excel
   - Supports multiple formats (long format, wide format)
   - Fills the entire weekly timesheet in one operation

2. **Daily Processing**
   - Convert daily Time Activity Reports to Weekly Timesheets
   - Process one day at a time
   - Fuzzy name matching with anomaly detection

3. **Cash & Payroll Generation**
   - Generate Cash and Payroll reports from weekly hours
   - Employee type categorization (A/B/C)
   - Bonus calculations (Foreman, 3x, 0.5x, 1x)
   - Loan processing with automatic deductions

### File Management (with Supabase)

- **Template Storage**: Upload template files once, use them automatically
- **Output History**: View and download all processed files week over week
- Works without Supabase too - files just download directly

### Settings Panel

Configure all processing parameters:
- Hour rounding (15min, 30min, 1hr) with modes (nearest, up, down)
- Daily/weekly hour caps and OT thresholds
- Name matching sensitivity
- Bonus multipliers
- Loan processing options
- Output file naming

## Quick Start

### Option 1: Without Supabase (Simple)

```bash
cd web-app
./run.sh
```

Then open http://localhost:3000

### Option 2: With Supabase (File Persistence)

1. Create a Supabase project at https://supabase.com

2. Run the SQL setup in your Supabase SQL Editor:
   ```
   See: supabase_setup.sql
   ```

3. Create `.env` file in the backend folder:
   ```
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_KEY=your-anon-public-key
   ```

4. Run the app:
   ```bash
   ./run.sh
   ```

### Option 3: Docker

```bash
docker-compose up
```

## API Endpoints

### Settings
- `GET /api/settings` - Get current settings
- `PUT /api/settings` - Update settings
- `POST /api/settings/reset` - Reset to defaults

### Storage (Supabase)
- `GET /api/storage/status` - Check if storage is configured
- `GET /api/templates` - List template files
- `POST /api/templates/{category}` - Upload template
- `GET /api/outputs` - List output history

### Processing
- `POST /api/fullweek/preview` - Preview full week processing
- `POST /api/fullweek/process` - Process full week
- `POST /api/daily/preview` - Preview daily processing
- `POST /api/daily/process` - Process daily
- `POST /api/weekly/preview` - Preview cash/payroll
- `POST /api/weekly/process` - Process cash/payroll

## File Formats

### Full Week Time Data (CSV/Excel)

**Long Format:**
```csv
Employee,Date,Hours
John Smith,1/13/2025,8.5
John Smith,1/14/2025,9.0
Jane Doe,1/13/2025,8.0
```

**Wide Format:**
```csv
Employee,Mon,Tue,Wed,Thu,Fri
John Smith,8.5,9.0,8.0,8.5,8.0
Jane Doe,8.0,8.0,8.0,8.0,8.0
```

### Template Files

| Template | Purpose |
|----------|---------|
| Weekly Timesheet | Employee hours by day with Reg/OT columns |
| Cash Template | Name, Type (R/OT), Hours, Rate columns |
| Payroll Template | Name, Type (R/OT/SICK), Hours columns |
| Reimb & Bonus | Yards, Name, Reimbursement, Bonus Position, Uploads |
| Loans | Name, Amount, Payment, Total Paid, Balance |

## Project Structure

```
web-app/
├── backend/
│   ├── main.py              # FastAPI application
│   ├── config.py            # Settings models
│   ├── storage.py           # Supabase integration
│   └── processors/
│       ├── daily_processor.py
│       ├── weekly_processor.py
│       └── fullweek_processor.py
├── frontend/
│   └── src/
│       ├── App.jsx
│       └── components/
│           ├── DailyProcessor.jsx
│           ├── WeeklyProcessor.jsx
│           ├── FullWeekProcessor.jsx
│           ├── FilesPanel.jsx
│           └── SettingsPanel.jsx
├── supabase_setup.sql       # Database setup
├── docker-compose.yml
└── run.sh
```

## Settings Guide

### Hour Rounding
- **Round To**: 0.25 (15 min), 0.5 (30 min), or 1.0 (1 hour)
- **Round Mode**: "nearest", "up", or "down"
- **Special Rules**: e.g., 8:25 rounds to 8:00 instead of 8:30

### Name Matching
- **Strict Score**: Primary threshold (default 92)
- **Fallback Score**: For last-name matching (default 85)
- Higher = stricter matching

### Employee Types
- **Type A**: Full Payroll (regular → payroll, OT → cash)
- **Type B**: All Cash (capped at 40, overflow → cash OT)
- **Type C**: Split (payroll capped at 24 after sick, rest → cash)
