@echo off
chcp 65001 > nul
echo =======================================================
echo    جاري تحديث ورفع ملفات فاكهة سيتي إلى GitHub...
echo =======================================================
cd /d "D:\fruit city project"
set "PATH=%LOCALAPPDATA%\Programs\Git\cmd;%LOCALAPPDATA%\Programs\Git\ucrt64\bin;%PATH%"

git add .
git commit -m "تحديث تلقائي: %date% - %time%"
git push origin main

echo.
echo =======================================================
echo    ✅ تم رفع أحدث نسخة إلى GitHub بنجاح!
echo =======================================================
timeout /t 3 > nul