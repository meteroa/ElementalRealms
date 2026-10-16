@echo off
title Elemental Realms - Build PC Executable
echo ===============================================================
echo     Elemental Realms - PC Packaging Tool (Windows x64)
echo ===============================================================
echo.

cd /d "%~dp0android"

echo [1/2] Compiling production assets (tsc and vite build)...
call npm run build
if errorlevel 1 (
    echo.
    echo [Error] Web build failed! Please check errors above.
    pause
    exit /b 1
)

echo.
echo [2/2] Packaging executable with Electron-Builder...
echo Output directory will be: release_pc\
call npx electron-builder --config electron-builder.json
if errorlevel 1 (
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
