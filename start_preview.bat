@echo off
chcp 65001 >nul
title 元素秘境 · 魔导对决 - 生产打包与运行
echo ===============================================================
echo        元素秘境 · 魔导对决 (Elemental Realms)
echo                 生产打包预览启动器 (Preview)
echo ===============================================================
echo.

cd /d "%~dp0android"

if not exist "node_modules" (
    echo [提示] 检测到首次运行，正在自动安装项目依赖...
    call npm install
    if errorlevel 1 (
        echo [错误] 依赖安装失败！
        pause
        exit /b 1
    )
)

echo [1/2] 正在执行生产环境编译优化 (TypeScript + Vite Build)...
call npm run build
if errorlevel 1 (
    echo.
    echo [错误] 编译构建未通过，请检查代码错误！
    pause
    exit /b 1
)

echo.
echo [2/2] 正在启动生产级静态预览服务器...
start "" http://localhost:5174
call npm run preview
