@echo off
chcp 65001 >nul
title 元素秘境 · 魔导对决 - PC 端打包工具 (.exe)
echo ===============================================================
echo        元素秘境 · 魔导对决 (Elemental Realms)
echo             PC 端桌面程序 (.exe) 一键打包工具
echo ===============================================================
echo.

cd /d "%~dp0android"

echo [1/3] 正在检查构建环境与依赖工具 (electron / electron-builder)...
call npm list electron-builder >nul 2>nul
if errorlevel 1 (
    echo [提示] 首次打包，正在自动安装打包核心依赖 (electron ^& electron-builder)...
    call npm install --save-dev electron electron-builder
    if errorlevel 1 (
        echo [错误] 打包依赖安装失败，请检查网络环境与 npm 源配置！
        pause
        exit /b 1
    )
)

echo.
echo [2/3] 正在执行生产环境编译优化 (tsc ^& vite build)...
call npm run build
if errorlevel 1 (
    echo [错误] 前端编译构建失败，请检查代码！
    pause
    exit /b 1
)

echo.
echo [3/3] 正在调用 Electron-Builder 打包生成 Windows 64位安装包 (.exe)...
echo 打包产物将自动输出至根目录下的 release_pc/ 文件夹中，请稍候...
call npx electron-builder --config electron-builder.json
if errorlevel 1 (
    echo.
    echo [错误] 打包过程异常退出，请查看上方输出日志！
    pause
    exit /b 1
)

echo.
echo ===============================================================
echo [成功] PC 端桌面程序打包完成！
echo 输出目录: %~dp0release_pc\
echo ===============================================================
pause
