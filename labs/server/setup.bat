@echo off
REM Amazon SP-API Mock Server - Windows Setup Script (no cloning; location-aware)
setlocal enabledelayedexpansion

REM ── Always run relative to this script's directory (i.e., labs\server) ───────
pushd "%~dp0"

REM ── Configuration ────────────────────────────────────────────────────────────
set "VENV_DIR=venv"
set "HOST=0.0.0.0"
set "PORT=8000"

echo.
echo ========================================================
echo   Amazon SP-API Mock Server - Automated Setup
echo ========================================================
echo.

REM ── Check Python (and version >= 3.8) ────────────────────────────────────────
echo [INFO] Checking prerequisites...
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is not installed or not in PATH
    echo Please install Python 3.8+ from https://www.python.org/
    pause
    popd
    exit /b 1
)

python -c "import sys; exit(0 if sys.version_info >= (3,8) else 1)"
if errorlevel 1 (
    echo [ERROR] Python 3.8 or higher is required.
    echo Detected:
    python --version
    pause
    popd
    exit /b 1
)
echo [OK] Python 3.8+ found

echo.
echo [INFO] Step 1/4: Creating virtual environment...
if exist "%VENV_DIR%" (
    echo [WARNING] Virtual environment already exists
    set /p CHOICE="Do you want to recreate it? (Y/N): "
    if /i "!CHOICE!"=="Y" (
        rmdir /s /q "%VENV_DIR%"
        python -m venv "%VENV_DIR%"
        if errorlevel 1 (
            echo [ERROR] Failed to create virtual environment
            pause
            popd
            exit /b 1
        )
        echo [OK] Virtual environment created
    ) else (
        echo [INFO] Using existing virtual environment
    )
) else (
    python -m venv "%VENV_DIR%"
    if errorlevel 1 (
        echo [ERROR] Failed to create virtual environment
        pause
        popd
        exit /b 1
    )
    echo [OK] Virtual environment created
)

echo.
echo [INFO] Step 2/4: Activating virtual environment...
call "%VENV_DIR%\Scripts\activate.bat"
if errorlevel 1 (
    echo [ERROR] Failed to activate virtual environment
    pause
    popd
    exit /b 1
)
echo [OK] Virtual environment activated

echo.
echo [INFO] Upgrading pip...
python -m pip install --quiet --upgrade pip
if errorlevel 1 (
    echo [ERROR] Failed to upgrade pip
    pause
    popd
    exit /b 1
)
echo [OK] pip upgraded

echo.
echo [INFO] Step 3/4: Installing dependencies...
if not exist "requirements.txt" (
    echo [ERROR] requirements.txt not found
    pause
    popd
    exit /b 1
)

pip install --quiet -r requirements.txt
if errorlevel 1 (
    echo [ERROR] Failed to install dependencies
    pause
    popd
    exit /b 1
)
echo [OK] Dependencies installed

echo.
echo [INFO] Step 4/4: Verifying setup...
if not exist "responses" (
    echo [WARNING] responses\ directory not found
    echo [INFO] Creating responses\ directory...
    mkdir "responses"
    echo [WARNING] Please ensure all required JSON response files are in the responses\ directory
) else (
    echo [OK] responses\ directory found
)

if not exist "main.py" (
    echo [ERROR] main.py not found in current directory
    pause
    popd
    exit /b 1
)
echo [OK] main.py found

echo.
echo ========================================================
echo   Setup completed successfully!
echo ========================================================
echo.
echo Server Details:
echo   * Local URL:        http://localhost:%PORT%
echo   * Network URL:      http://%HOST%:%PORT%
echo   * Health Check:     http://localhost:%PORT%/health
echo.
echo [INFO] Starting server in 3 seconds...
timeout /t 3 /nobreak >nul

echo.
echo ========================================================
echo   Server Starting...
echo   Press CTRL+C to stop the server
echo ========================================================
echo.

REM ── Start the server ─────────────────────────────────────────────────────────
uvicorn main:app --reload --host %HOST% --port %PORT%

popd
pause
