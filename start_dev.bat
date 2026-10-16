@echo off
chcp 65001 >nul
title 元素秘境 · 魔导对决 - 一键快速启动 (开发调试)
echo ===============================================================
echo        元素秘境 · 魔导对决 (Elemental Realms)
echo                 一键快速启动器 (Dev)
echo ===============================================================
echo.

cd /d "%~dp0android"

if not exist "node_modules" (
    echo [提示] 检测到首次运行，正在自动安装项目依赖，请稍候...
    call npm install
    if errorlevel 1 (
        echo.
        echo [错误] 依赖安装失败，请检查网络连接及 Node.js 环境！
        pause
        exit /b 1
    )
    echo [完成] 依赖安装成功！
    echo.
)

echo [1/2] 正在启动 Vite 开发服务 (默认端口 5174)...
echo [2/2] 即将为您自动开启默认浏览器并载入对决界面...
echo.
echo 服务就绪后，可直接在浏览器中畅玩；按 Ctrl + C 可终止服务。
echo ---------------------------------------------------------------

start "" http://localhost:5174
call npm run dev
