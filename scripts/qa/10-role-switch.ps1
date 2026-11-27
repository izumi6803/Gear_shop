# Scenario 10 — Regression: switching accounts must not reuse the previous session
# Run: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/qa/10-role-switch.ps1

$ErrorActionPreference = 'Stop'
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force -ErrorAction SilentlyContinue
. (Join-Path $PSScriptRoot '..\bc-lib.ps1')

$script:BcFailures = 0
$base = 'http://localhost:4173'
if ($env:SPA_BASE) { $base = $env:SPA_BASE }

function Current-Chip { (Bc-Text '.app-user-meta strong').text.Trim() }
function Current-Role { (Bc-Text '.app-user-meta small').text.Trim() }
function Nav-Items { (((Bc-Text '.app-nav-link' -All).texts) -join '|') }

function Login-As([string]$user, [string]$pass) {
    Bc-Fill '[data-testid=login-username]' $user
    Bc-Fill '[data-testid=login-password]' $pass
    Bc-Click '[data-testid=login-submit]'
    Start-Sleep -Milliseconds 2200
}

function Logout {
    Bc-Click '[data-testid=logout]'
    Start-Sleep -Milliseconds 1400
}

Write-Host "`n== 1. Sign in as admin" -ForegroundColor Cyan
Bc-Open "$base/login" -Storage @{ 'stockflow.lang' = 'en' } | Out-Null
Start-Sleep -Milliseconds 1000
Bc-Assert ([string](Bc-Eval "document.querySelector('[data-testid=login-username]').value") -eq '') 'login form starts empty (no stale/autofilled account)' | Out-Null
Login-As 'admin' 'Admin@123'
Bc-Assert ((Current-Chip) -eq 'System Administrator') "chip shows admin (=$(Current-Chip))" | Out-Null
Bc-Assert ((Current-Role) -eq 'Admin') "role shows Admin (=$(Current-Role))" | Out-Null
Bc-Assert ((Nav-Items) -match 'New order') 'admin sees New order' | Out-Null

Write-Host "`n== 2. Sign out clears the session completely" -ForegroundColor Cyan
Logout
Bc-Assert ((Bc-Url) -like '*/login') "back at /login (url=$(Bc-Url))" | Out-Null
if ($null -eq $IsWindows -or $IsWindows) { } # noop
$token = Bc-Eval "String(sessionStorage.getItem('stockflow.token'))"
$storedUser = Bc-Eval "String(sessionStorage.getItem('stockflow.user'))"
Bc-Assert ($token -eq 'null') "token removed (=$token)" | Out-Null
Bc-Assert ($storedUser -eq 'null') "cached user removed (=$storedUser)" | Out-Null

Write-Host "`n== 3. Sign in as sales → must be sales, not admin" -ForegroundColor Cyan
Login-As 'sales' 'Sales@123'
Bc-Assert ((Current-Chip) -eq 'Alex Morgan') "chip switched to sales (=$(Current-Chip))" | Out-Null
Bc-Assert ((Current-Role) -eq 'Sales') "role switched to Sales (=$(Current-Role))" | Out-Null
Bc-Assert ((Nav-Items) -match 'New order') 'sales sees New order' | Out-Null
Bc-Shot 'role-switch-01-sales' | Out-Null

Write-Host "`n== 4. Sign out → sign in as viewer → must be viewer" -ForegroundColor Cyan
Logout
Login-As 'viewer' 'Viewer@123'
Bc-Assert ((Current-Chip) -eq 'Dana Whitfield') "chip switched to viewer (=$(Current-Chip))" | Out-Null
Bc-Assert ((Current-Role) -eq 'Viewer') "role switched to Viewer (=$(Current-Role))" | Out-Null
$navViewer = Nav-Items
Write-Host "     viewer nav: $navViewer" -ForegroundColor DarkGray
Bc-Assert ($navViewer -notmatch 'New order') 'viewer does NOT see New order' | Out-Null
Bc-Shot 'role-switch-02-viewer' | Out-Null

Write-Host "`n== 5. Viewer cannot reach the create page by URL" -ForegroundColor Cyan
Bc-Goto "$base/orders/new" | Out-Null
Start-Sleep -Milliseconds 1600
Bc-Assert ((Bc-Url) -like '*/orders') "redirected away from /orders/new (url=$(Bc-Url))" | Out-Null
Bc-Assert ((Current-Role) -eq 'Viewer') "still viewer after redirect (=$(Current-Role))" | Out-Null

Write-Host "`n== 6. Back to admin → admin again" -ForegroundColor Cyan
Logout
Login-As 'admin' 'Admin@123'
Bc-Assert ((Current-Chip) -eq 'System Administrator') "chip back to admin (=$(Current-Chip))" | Out-Null
Bc-Assert ((Current-Role) -eq 'Admin') "role back to Admin (=$(Current-Role))" | Out-Null

Write-Host "`n== 7. Tampered storage: stored user says Admin, token says Sales" -ForegroundColor Cyan
Bc-Eval "sessionStorage.setItem('stockflow.user', JSON.stringify({name:'System Administrator',role:'Admin',username:'admin'}))" | Out-Null
Bc-Goto "$base/" | Out-Null
Start-Sleep -Milliseconds 2000
$chipAfter = (Bc-Text '.app-user-meta strong').text.Trim()
$roleAfter = (Bc-Text '.app-user-meta small').text.Trim()
Write-Host "     chip=$chipAfter role=$roleAfter" -ForegroundColor DarkGray
Bc-Assert ($roleAfter -eq 'Admin') "current session is admin after re-login (=$roleAfter)" | Out-Null
Bc-Assert ($chipAfter -eq 'System Administrator') "chip matches the token (=$chipAfter)" | Out-Null

# Giờ đổi token thành của sales nhưng giữ user admin trong storage:
# app phải hiển thị theo TOKEN (sales) hoặc huỷ phiên, không được tin user cũ.
$salesToken = Bc-Eval "fetch('/ordering-api/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'sales',password:'Sales@123'})}).then(r=>r.json()).then(d=>d.accessToken)"
Bc-Eval "sessionStorage.setItem('stockflow.token', '$salesToken')" | Out-Null
Bc-Eval "sessionStorage.setItem('stockflow.user', JSON.stringify({name:'System Administrator',role:'Admin',username:'admin'}))" | Out-Null
Bc-Goto "$base/" | Out-Null
Start-Sleep -Milliseconds 2200
$chipTok = (Bc-Text '.app-user-meta strong').text.Trim()
$roleTok = (Bc-Text '.app-user-meta small').text.Trim()
Write-Host "     sau khi token=sales, user=admin → chip=$chipTok role=$roleTok" -ForegroundColor DarkGray
Bc-Assert ($roleTok -eq 'Sales') "token wins over stale stored user (=$roleTok)" | Out-Null
Bc-Assert ($chipTok -eq 'Alex Morgan') "chip shows the token account (=$chipTok)" | Out-Null
Bc-Shot 'role-switch-04-token-wins' | Out-Null

Write-Host "`n== 8. Sign-in toast names the account" -ForegroundColor Cyan
Bc-Click '[data-testid=logout]'
Start-Sleep -Milliseconds 1300
Bc-Fill '[data-testid=login-username]' 'viewer'
Bc-Fill '[data-testid=login-password]' 'Viewer@123'
Bc-Click '[data-testid=login-submit]'
Start-Sleep -Milliseconds 2000
$toasts = (Bc-Text '.app-toast' -All).texts
$signInToast = ($toasts | Where-Object { $_ -match 'Dana Whitfield' } | Select-Object -First 1)
Write-Host "     toast: $signInToast" -ForegroundColor DarkGray
Bc-Assert ([string]$signInToast -match 'Viewer') "toast says who signed in (=${signInToast})" | Out-Null
Bc-Shot 'role-switch-05-signin-toast' | Out-Null
Write-Host "`n== 9. Console / network" -ForegroundColor Cyan
$console = Bc-Console -Clear
$pageErrors = @($console.console | Where-Object { $_.type -eq 'pageerror' })
$badHttp = @($console.networkErrors | Where-Object { $_.status -ne 409 })
Bc-Assert ($pageErrors.Count -eq 0) "no JS exception (count=$($pageErrors.Count))" | Out-Null
Bc-Assert ($badHttp.Count -eq 0) "no HTTP error other than 409 (count=$($badHttp.Count))" | Out-Null
if ($pageErrors.Count -gt 0) { $pageErrors | ForEach-Object { Write-Host "     $($_.text)" -ForegroundColor DarkGray } }

if ($script:BcFailures -gt 0) {
    Write-Host "`n$($script:BcFailures) checks FAILED" -ForegroundColor Red
    exit 1
}

Write-Host "`nROLE SWITCH: ALL PASS" -ForegroundColor Green
