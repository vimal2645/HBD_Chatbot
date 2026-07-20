@echo off
REM Backend Server Startup Script for Windows
REM Start the HBD Local Business AI Backend API Server

:: Use %~dp0 to reference the directory containing this script
cd /d "%~dp0"
set PYTHONIOENCODING=utf-8

echo.
echo ====================================================================
echo HBD Local Business AI - Backend Server
echo ====================================================================
echo.
echo Database: Remote MySQL Database
echo Starting FastAPI server on http://127.0.0.1:5000
echo.
echo Press CTRL+C to stop the server
echo.
echo ====================================================================
echo.

:: Check and Create Virtual Environment
if not exist ".\.venv\Scripts\python.exe" (
    echo Virtual environment (.venv) not found. Creating it...
    where python >nul 2>nul
    if errorlevel 1 (
        echo.
        echo ERROR: Python was not found on your system path.
        echo Please install Python 3.10+ and make sure it is added to your PATH.
        echo.
        pause
        exit /b 1
    )
    python -m venv .venv
    if errorlevel 1 (
        echo ERROR: Failed to create virtual environment.
        pause
        exit /b 1
    )
    echo Virtual environment created successfully!
)

:: Check and Install Missing Libraries
echo Checking and installing required libraries...
".\.venv\Scripts\python.exe" -m pip install --upgrade pip
".\.venv\Scripts\python.exe" -m pip install -r requirements.txt

:: Use relative path to the virtual environment in the root folder
".\.venv\Scripts\python.exe" -m uvicorn api:app --host 127.0.0.1 --port 5000 --reload

pause
