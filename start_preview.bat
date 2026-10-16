@echo off
title Elemental Realms - Preview
echo [Elemental Realms] Building production assets...
cd /d "%~dp0android"
call npm run build
if errorlevel 1 (
    echo [Error] Build failed! Please check code errors above.
    pause
    exit /b 1
)

echo [Elemental Realms] Launching preview server...
start "" http://localhost:5174
call npm run preview
if errorlevel 1 pause
