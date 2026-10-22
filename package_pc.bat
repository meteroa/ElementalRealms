@echo off
title Elemental Realms - Build PC Executable
echo ===============================================================
echo     Elemental Realms - PC Packaging Tool (Windows x64)
echo ===============================================================
echo.

cd /d "%~dp0android"

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [Error] Node.js is not found. Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

if not exist "node_modules\" (
    echo [Elemental Realms] Dependencies not found. Running npm install, please wait...
    echo.
    call npm install
    if %errorlevel% neq 0 (
        echo.
        echo [Error] npm install failed. Please check your network connection.
        pause
        exit /b 1
    )
    echo.
    echo [Elemental Realms] Dependencies successfully installed!
    echo.
)

echo [1/2] Compiling production assets (tsc and vite build)...
call npm run build
if %errorlevel% neq 0 (
    echo.
    echo [Error] Web build failed! Please check errors above.
    pause
    exit /b 1
)

echo.
echo [2/2] Packaging executable with Electron-Builder...
echo Output directory will be: release_pc\
call npx electron-builder --config electron-builder.json
if %errorlevel% neq 0 (
    echo.
    echo [Error] Electron packaging failed!
    pause
    exit /b 1
)

echo.
echo ===============================================================
echo [Success] PC Executable successfully packaged!
echo Output folder: %~dp0release_pc\
echo ===============================================================
pause
