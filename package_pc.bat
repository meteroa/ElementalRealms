@echo off
title Elemental Realms - Build PC Executable
chcp 65001 >nul
echo ===============================================================
echo     Elemental Realms - PC Packaging Tool (Windows x64)
echo ===============================================================
echo.

cd /d "%~dp0android"

where node >nul 2>nul
if errorlevel 1 (
    echo [Error] 未检测到 Node.js，请先安装 Node.js (https://nodejs.org/) 并配置 PATH 环境变量。
    pause
    exit /b 1
)

if not exist "node_modules\" (
    echo [Elemental Realms] 首次运行检测：未找到依赖包 (node_modules)。
    echo 正在自动安装项目依赖 (npm install)，请稍候...
    echo.
    call npm install
    if errorlevel 1 (
        echo.
        echo [Error] 依赖安装失败，请检查网络连接后重试。
        pause
        exit /b 1
    )
    echo.
    echo [Elemental Realms] 依赖安装完成！
    echo.
)

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
