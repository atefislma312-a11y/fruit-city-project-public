[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host "    فحص ومزامنة ملفات فاكهة سيتي مع GitHub" -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Cyan

$projectDir = "D:\fruit city project"
Set-Location $projectDir

if (!(Test-Path ".git")) {
    Write-Host "[خطأ] المجلد الحالي ليس مستودع Git صالح!" -ForegroundColor Red
    exit 1
}

$env:Path = "$env:LOCALAPPDATA\Programs\Git\cmd;$env:LOCALAPPDATA\Programs\Git\ucrt64\bin;$env:Path"
if (!(Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "[خطأ] لم يتم العثور على أداة Git على هذا الجهاز!" -ForegroundColor Red
    exit 1
}

Write-Host "جاري فحص وتجهيز الملفات المصرح برفعها..." -ForegroundColor Yellow

# Stage permitted files only (Selective Staging)
$permittedItems = @(
    "AGENTS.md",
    "PROJECT_MASTER_SUMMARY.md",
    ".gitignore",
    "تحديث_جيت_هاب.bat",
    "sync_github.ps1",
    "محادثاتي مع نماذج الذكاء الاصطناعي",
    "docs",
    "web_app",
    "التسويق والسوشيال ميديا",
    ".gemini",
    "app"
)

foreach ($item in $permittedItems) {
    if (Test-Path $item) {
        git add -- $item 2>$null
    }
}

# Strict unstage for any sensitive files or databases
git reset -q -- "docs/security/password.txt" "docs/security/.meta_token" *.db *.sqlite *.env *.token 2>$null

# Check if there are staged changes
git diff --cached --quiet
$hasStagedChanges = ($LASTEXITCODE -ne 0)

if ($hasStagedChanges) {
    Write-Host "تم رصد تعديلات جديدة.. جاري إنشاء الحفظ المحلي (Commit)..." -ForegroundColor Yellow
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    git commit -m "تحديث توثيق فاكهة سيتي: $timestamp"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[خطأ] فشلت عملية الحفظ المحلي (git commit)!" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "لا توجد تعديلات محلية جديدة تحتاج لحفظ." -ForegroundColor Gray
}

# Check unpushed commits
$unpushed = git log origin/main..HEAD --oneline 2>$null
if (!$unpushed) {
    Write-Host ""
    Write-Host "=======================================================" -ForegroundColor Green
    Write-Host "    المستودع السحابي محدث بالكامل بالفعل. لا يلزم الرفع." -ForegroundColor Green
    Write-Host "=======================================================" -ForegroundColor Green
    Start-Sleep -Seconds 2
    exit 0
}

Write-Host "جاري الرفع إلى GitHub (origin/main)..." -ForegroundColor Yellow
git push origin main
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "=======================================================" -ForegroundColor Red
    Write-Host "    ❌ فشل الرفع إلى GitHub!" -ForegroundColor Red
    Write-Host "    الأسباب المحتملة: انقطاع الإنترنت أو مشكلة صلاحيات SSH." -ForegroundColor Red
    Write-Host "=======================================================" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=======================================================" -ForegroundColor Green
Write-Host "    ✅ تم التحقق والرفع إلى GitHub بنجاح!" -ForegroundColor Green
Write-Host "=======================================================" -ForegroundColor Green
Start-Sleep -Seconds 2
exit 0