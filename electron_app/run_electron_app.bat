@echo off
title VIMTA Labs • AI Machine Reading Automation
echo Starting Modern Electron Desktop Application...
echo.

cd /d "%~dp0"

echo Checking dependencies...
where node >nul 2>nul
if errorlevel 1 (
    echo Error: Node.js is not installed. Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
    echo Error: npm is not installed. Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo Installing dependencies...
call npm install

echo.
echo Starting VIMTA Labs Modern Desktop Application...
echo.
call npm start

if errorlevel 1 (
    echo.
    echo Application encountered an error.
    pause
)
