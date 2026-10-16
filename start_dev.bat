@echo off
title Elemental Realms - Dev
echo [Elemental Realms] Starting Dev Server...
cd /d "%~dp0android"
start "" http://localhost:5174
call npm run dev
if errorlevel 1 pause
