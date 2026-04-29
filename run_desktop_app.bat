@echo off
title Vimta Labs - AI Machine Reading Automation
echo Starting Desktop Application...
echo.

cd /d "%~dp0"

echo Checking dependencies...
python -c "import tkinter" 2>nul
if errorlevel 1 (
    echo Error: tkinter is not available. Please install Python with tkinter support.
    pause
    exit /b 1
)

python -c "import PIL" 2>nul
if errorlevel 1 (
    echo Installing Pillow...
    pip install Pillow
)

echo.
echo Starting VIMTA Labs Modern Machine Reading System...
echo.
python modern_desktop_app.py

if errorlevel 1 (
    echo.
    echo Application encountered an error.
    pause
)
