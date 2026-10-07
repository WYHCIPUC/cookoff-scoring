@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
title 厨艺大赛打分工具 - 一键部署到云端
cd /d %~dp0

echo ================================================
echo   厨艺大赛打分工具 · 云端一键部署
echo ================================================
echo.

rem ---- 检查登录 ----
tcb env list > "%TEMP%\tcb_envs.txt" 2>&1
findstr /C:"EnvId" /C:"环境ID" "%TEMP%\tcb_envs.txt" >nul 2>&1
if errorlevel 1 (
  echo 尚未登录腾讯云，为你发起登录...
  echo 浏览器会打开授权页：扫码登录腾讯云 - 点「确认授权」
  call tcb login
  tcb env list > "%TEMP%\tcb_envs.txt" 2>&1
)

set ENVID=
rem ---- 尝试自动提取第一个环境 ID ----
for /f "tokens=*" %%L in ('type "%TEMP%\tcb_envs.txt" ^| findstr /R /C:"cloud[0-9]-[a-z0-9]*"') do (
  if "!ENVID!"=="" (
    for %%X in (%%L) do (
      echo %%X | findstr /R /C:"^cloud[0-9]" >nul && (set ENVID=%%X)
    )
  )
)

echo 已有环境列表：
type "%TEMP%\tcb_envs.txt"
echo.

if "!ENVID!"=="" (
  echo 没有找到云开发环境，现在为你创建（按量付费，含免费额度，本工具用量为 0 元）...
  call tcb env create cook-off
  tcb env list > "%TEMP%\tcb_envs.txt" 2>&1
  for /f "tokens=*" %%L in ('type "%TEMP%\tcb_envs.txt" ^| findstr /R /C:"cloud[0-9]-[a-z0-9]*"') do (
    if "!ENVID!"=="" (
      for %%X in (%%L) do (
        echo %%X | findstr /R /C:"^cloud[0-9]" >nul && (set ENVID=%%X)
      )
    )
  )
)

if "!ENVID!"=="" (
  set /p ENVID=未能自动获取环境ID，请到 https://tcb.cloud.tencent.com 控制台查看后输入: 
)
if "!ENVID!"=="" (echo 未提供环境ID，退出 & pause & exit /b 1)

echo 使用环境: !ENVID!
echo.

echo [1/4] 初始化云端资源（集合 / 权限 / 匿名登录）...
call node scripts\setup-cloud.mjs !ENVID!

echo.
echo [2/4] 构建部署版（注入环境 ID）...
call node scripts\build-dist.mjs !ENVID!
if errorlevel 1 (pause & exit /b 1)

echo.
echo [3/3] 上传静态托管...
call tcb hosting deploy dist -e !ENVID!

echo.
echo ================================================
echo   部署完成！把这个链接发给参赛伙伴（或生成二维码现场扫码）：
echo.
echo   https://!ENVID!-1259386436.tcloudbaseapp.com/
echo.
echo   首次使用请确认（控制台 https://tcb.cloud.tencent.com/dev?envId=!ENVID! ）：
echo   1) 「身份认证-登录方式」已开启匿名登录（必须）
echo   2) 「环境-安全域名」包含 !ENVID!-1259386436.tcloudbaseapp.com
echo ================================================
pause
