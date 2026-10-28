@echo off
chcp 65001 > nul
title ديب سيك - مساعد البرمجة لمشروع فاكهة سيتي
color 0B

echo ======================================================================
echo           🍎 مرحباً إسلام! أداة تشغيل DeepSeek لمشروع فاكهة سيتي
echo ======================================================================
echo.

cd /d "D:\fruit city project"

if not exist ".env" (
    type nul > .env
)

findstr /i "^DEEPSEEK_API_KEY=" .env > nul 2>&1
if not errorlevel 1 goto KEY_FOUND

:ASK_KEY
echo [!] لم يتم العثور على مفتاح DeepSeek API في ملف .env
echo.
echo يرجى لصق الـ API Key الخاص بك (الذي يبدأ بـ sk-...):
set /p D_KEY="> "
if "%D_KEY%"=="" goto ASK_KEY
echo DEEPSEEK_API_KEY=%D_KEY%>> .env
echo [OK] تم حفظ المفتاح بنجاح وبأمان في ملف .env ولن يطلب منك ثانية!
echo.

:KEY_FOUND
echo اختر الإصدار الذي تريد تشغيله:
echo   [1] DeepSeek-V3 (سريع جداً وممتاز وموفر للأكواد) [الافتراضي]
echo   [2] DeepSeek-R1 (التفكير المنطقي العميق لحل المشاكل المعقدة)
echo.
set MODEL_CHOICE=1
set /p MODEL_CHOICE="اختر 1 أو 2 (أو اضغط Enter للافتراضي 1): "

set SELECTED_MODEL=deepseek/deepseek-chat
if "%MODEL_CHOICE%"=="2" (
    set SELECTED_MODEL=deepseek/deepseek-reasoner
    echo.
    echo [OK] تم اختيار: DeepSeek-R1 (التفكير العميق والمنطق)
) else (
    echo.
    echo [OK] تم اختيار: DeepSeek-V3 (السريع)
)

echo.
echo ======================================================================
echo  📌 نصائح سريعة:
echo  - ديب سيك الآن مفتوح على مجلد D:\fruit city project ومربوط بالـ Git.
echo  - عشان تديله ملف معين يعدله: اكتب /add مسار الملف (مثلاً: /add bridge.mjs)
echo  - عشان تخرج في أي وقت: اكتب /exit
echo ======================================================================
echo.

"C:\Users\MR.X\.local\bin\aider.exe" --model %SELECTED_MODEL% --chat-language Arabic --commit-language Arabic

if errorlevel 1 (
    echo.
    echo حدث تنبيه أثناء التشغيل. اضغط أي زر للإغلاق.
    pause
)
