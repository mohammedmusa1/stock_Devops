@echo off
setlocal EnableDelayedExpansion

:: Install DevOps Windows Machine - Batch Launcher
:: This script elevates to Administrator and runs the PowerShell setup script.

echo ====================================================
echo StockDevOps / Antigravity - DevOps Machine Setup
echo ====================================================

:: Check for Administrator privileges
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Requesting Administrative privileges...
    powershell -Command "Start-Process cmd -ArgumentList '/c %~dpnx0' -Verb RunAs"
    exit /b
)

echo [SUCCESS] Running as Administrator.
echo.

:: Get the directory of this batch file
set SCRIPT_DIR=%~dp0

:: Check if the PowerShell script exists
if not exist "%SCRIPT_DIR%setup-devops.ps1" (
    echo [ERROR] Cannot find setup-devops.ps1 in %SCRIPT_DIR%
    pause
    exit /b 1
)

:: Run the PowerShell script
echo [INFO] Launching PowerShell Setup Script...
powershell -NoProfile -ExecutionPolicy Bypass -Command "& '%SCRIPT_DIR%setup-devops.ps1'"

echo.
echo [INFO] Setup Launcher completed.
pause
