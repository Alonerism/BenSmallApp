# BenSmallApp

A Python GUI application for payroll management.

## Building Windows Executable

This project includes a GitHub Actions workflow that automatically builds a Windows executable (.exe) file.

### Setup Instructions

1. Create a new GitHub repository named "BenSmallApp"
2. Push this code to your GitHub repository
3. The GitHub Actions workflow will automatically build the Windows executable
4. Download the artifact from the Actions tab

### Manual Build (if needed)

To build locally on Windows:

```bash
pip install -r requirements.txt
pip install pyinstaller
pyinstaller app2.py --onefile --noconsole --name "BenSmallApp"
```

The executable will be created in the `dist/` folder.

## Usage

Double-click BenSmallApp.exe to run the application.
