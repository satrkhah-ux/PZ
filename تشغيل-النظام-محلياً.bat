@echo off
chcp 65001 >nul
title بيزارا كافيه - تشغيل محلي (طوارئ)
cd /d "%~dp0"
echo.
echo ==========================================
echo   بيزارا كافيه - تشغيل النظام على هذا الجهاز
echo ==========================================
echo.
echo هذا للطوارئ فقط عند توقف الموقع.
echo الطلبات تُحفظ في نفس قاعدة البيانات السحابية.
echo.
if not exist ".next" (
  echo [1/2] بناء النظام لأول مرة... قد يستغرق دقيقتين
  call npm run build || goto :err
) else (
  echo [1/2] النسخة المبنية جاهزة
)
echo [2/2] تشغيل الخادم...
echo.
echo   افتح المتصفح على:  http://localhost:3000/cashier
echo   لإيقاف النظام: أغلق هذه النافذة
echo.
set PORT=3000
call npm start
goto :eof
:err
echo.
echo تعذّر البناء. تأكد من تثبيت Node.js ومن وجود ملف .env.local
pause
