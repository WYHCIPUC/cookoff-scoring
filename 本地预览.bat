@echo off
chcp 65001 >nul
title 厨艺大赛打分工具 - 本地预览（演示模式）
cd /d %~dp0\public
echo ================================================
echo   演示模式预览，数据仅保存在本机浏览器
echo   手机扫码体验：手机与电脑连同一 WiFi，
echo   手机浏览器访问 http://电脑IP:8081
echo ================================================
echo.
where python >nul 2>nul && (python -m http.server 8081) || (where py >nul 2>nul && (py -m http.server 8081) || (echo 未找到 Python，请安装 Python 或使用任意静态服务器) )
pause
