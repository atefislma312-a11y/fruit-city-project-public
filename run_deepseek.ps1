[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$Host.UI.RawUI.WindowTitle = "DeepSeek Project Agent - Fruit City"

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "          🍎 مرحباً إسلام ودكتور محمد! أداة DeepSeek لمشروع فاكهة سيتي" -ForegroundColor Yellow
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""

$projectDir = "D:\fruit city project"
Set-Location $projectDir

# 1. قراءة مفتاح الـ API من ملف .env
$envFile = Join-Path $projectDir ".env"
$apiKey = $null
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match "^\s*DEEPSEEK_API_KEY\s*=\s*(.+)$") {
            $apiKey = $matches[1].Trim()
        }
    }
}

if (-not $apiKey) {
    Write-Host "[!] لم يتم العثور على مفتاح DeepSeek API في ملف .env" -ForegroundColor Red
    $apiKey = Read-Host "يرجى لصق الـ API Key الخاص بك (يبدأ بـ sk-...)"
    if ($apiKey) {
        Add-Content -Path $envFile -Value "DEEPSEEK_API_KEY=$apiKey"
        Write-Host "[OK] تم حفظ المفتاح بنجاح في ملف .env" -ForegroundColor Green
    } else {
        Write-Host "لم يتم إدخال مفتاح. سيتم إغلاق الأداة." -ForegroundColor Red
        Pause
        exit 1
    }
}

# 2. فحص الرصيد الفعلي للمفتاح مع سيرفرات DeepSeek
Write-Host "🔍 جاري فحص رصيد المفتاح مع سيرفرات DeepSeek..." -ForegroundColor Gray
$balanceOk = $false
try {
    $headers = @{
        "Authorization" = "Bearer $apiKey"
        "Accept" = "application/json"
    }
    $resp = Invoke-RestMethod -Uri "https://api.deepseek.com/user/balance" -Headers $headers -TimeoutSec 7 -ErrorAction Stop
    $totalBal = $resp.balance_infos[0].total_balance
    $isAvailable = $resp.is_available
    
    if ([double]$totalBal -gt 0 -and $isAvailable -eq $true) {
        Write-Host "✅ المفتاح مفعل ورصيدك الحالي: $totalBal دولار" -ForegroundColor Green
        $balanceOk = $true
    } else {
        Write-Host ""
        Write-Host "⚠️ تنبيه هام: رصيد المفتاح الحالي: $totalBal دولار (غير مشحون)." -ForegroundColor Yellow
        Write-Host "ديب سيك لا يقدم رصيداً مجانياً لهذا الحساب، ويتطلب شحن بحد أدنى 2 دولار ليعمل الـ API." -ForegroundColor Yellow
        Write-Host "رابط شحن الرصيد: https://platform.deepseek.com/top_up" -ForegroundColor Cyan
        Write-Host ""
    }
} catch {
    Write-Host "تنبيه أثناء الاتصال بسيرفر فحص الرصيد: $($_.Exception.Message)" -ForegroundColor DarkYellow
}

Write-Host ""
Write-Host "اختر الإصدار الذي تريد تشغيله:" -ForegroundColor White
Write-Host "  [1] DeepSeek-V3 (سريع وموفر للأكواد العادية) [الافتراضي]" -ForegroundColor Green
Write-Host "  [2] DeepSeek-R1 (التفكير المنطقي العميق لحل المشاكل المعقدة)" -ForegroundColor Magenta
Write-Host ""
$choice = Read-Host "اختر 1 أو 2 (أو اضغط Enter للافتراضي 1)"

$selectedModel = "deepseek/deepseek-chat"
if ($choice -eq "2") {
    $selectedModel = "deepseek/deepseek-reasoner"
    Write-Host "`n[OK] تم اختيار: DeepSeek-R1 (التفكير العميق والمنطق)" -ForegroundColor Magenta
} else {
    Write-Host "`n[OK] تم اختيار: DeepSeek-V3 (السريع)" -ForegroundColor Green
}

Write-Host ""
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host " 📌 نصائح الاستخدام:" -ForegroundColor Yellow
Write-Host " - الأداة مفتوحة على مشروعك D:\fruit city project ومربوطة بـ Git." -ForegroundColor Gray
Write-Host " - لإضافة ملف تريده أن يعدله: اكتب /add ثم اسم الملف (مثلاً: /add bridge.mjs)" -ForegroundColor Gray
Write-Host " - للخروج في أي وقت: اكتب /exit" -ForegroundColor Gray
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""

$env:DEEPSEEK_API_KEY = $apiKey
$aiderPath = "C:\Users\MR.X\.local\bin\aider.exe"

& $aiderPath --model $selectedModel --chat-language Arabic --commit-language Arabic

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "توقفت الجلسة. اضغط Enter للإغلاق..." -ForegroundColor Gray
    Pause
}
