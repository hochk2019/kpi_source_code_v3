#!/usr/bin/env pwsh
<##
.SYNOPSIS
    Chạy toàn bộ chuỗi kiểm thử/lint/build cho KPI Source Code trên Windows 11 + PowerShell 7.
.DESCRIPTION
    Script này bảo đảm môi trường tương thích với SQL Server 2008 R2/ECUS bằng cách:
      - Kiểm tra phiên bản PowerShell và pnpm.
      - Cài đặt dependency (pnpm install --frozen-lockfile).
      - Chạy lint, unit test, build, và Playwright screenshot smoke-test.
      - Ghi log chi tiết vào thư mục ./.logs để thuận tiện đối chiếu.
    Khi có lỗi, script dừng ngay và trả mã thoát khác 0.
.PARAMETER SkipScreenshots
    Bỏ qua bước pnpm test:screenshot (hữu ích trên CI không có trình duyệt).
.EXAMPLE
    ./scripts/run-all-checks.ps1
.EXAMPLE
    ./scripts/run-all-checks.ps1 -SkipScreenshots
.NOTES
    Yêu cầu: PowerShell 7+, pnpm 8+, Node 18 LTS, Playwright đã cài đặt (pnpm exec playwright install --with-deps).
##>
[CmdletBinding()]
param(
    [switch]$SkipScreenshots
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Section {
    param([string]$Message)
    Write-Host "`n========== $Message ==========" -ForegroundColor Cyan
}

function Invoke-Step {
    param(
        [string]$Command,
        [string]$DisplayName
    )

    Write-Section $DisplayName
    $logDir = Join-Path -LiteralPath (Get-Location) -ChildPath '.logs'
    if (-not (Test-Path $logDir)) {
        New-Item -ItemType Directory -Path $logDir | Out-Null
    }

    $logFile = Join-Path -Path $logDir -ChildPath ((Get-Date).ToString('yyyyMMdd-HHmmss') + "-" + ($DisplayName -replace '\\s+', '_') + '.log')
    Write-Host "Lưu log: $logFile" -ForegroundColor DarkGray

    $psi = [System.Diagnostics.ProcessStartInfo]::new('pwsh', "-NoLogo -NoProfile -Command \"$Command\"")
    $psi.RedirectStandardError = $true
    $psi.RedirectStandardOutput = $true
    $psi.UseShellExecute = $false
    $process = [System.Diagnostics.Process]::Start($psi)
    $stdOut = $process.StandardOutput.ReadToEnd()
    $stdErr = $process.StandardError.ReadToEnd()
    $process.WaitForExit()

    $stdOut | Tee-Object -FilePath $logFile
    if ($stdErr) {
        "`n[stderr]`n$stdErr" | Tee-Object -FilePath $logFile -Append
    }

    if ($process.ExitCode -ne 0) {
        throw "Bước '$DisplayName' thất bại với mã $($process.ExitCode). Xem log: $logFile"
    }
}

Write-Section 'Kiểm tra phiên bản PowerShell'
$psVersion = $PSVersionTable.PSVersion
if ($psVersion.Major -lt 7) {
    throw "Yêu cầu PowerShell 7+. Phiên bản hiện tại: $psVersion"
}
Write-Host "PowerShell $psVersion" -ForegroundColor Green

Write-Section 'Kiểm tra pnpm'
try {
    $pnpmVersion = (pnpm --version)
    Write-Host "pnpm $pnpmVersion" -ForegroundColor Green
} catch {
    throw "Không tìm thấy pnpm. Cài đặt bằng: npm install -g pnpm"
}

Invoke-Step -Command 'pnpm install --frozen-lockfile' -DisplayName 'Cài đặt dependencies'
Invoke-Step -Command 'pnpm lint' -DisplayName 'Lint'
Invoke-Step -Command 'pnpm test' -DisplayName 'Unit tests'
Invoke-Step -Command 'pnpm build' -DisplayName 'Build production'

if (-not $SkipScreenshots) {
    Invoke-Step -Command 'pnpm test:screenshot' -DisplayName 'Playwright screenshot smoke-test'
} else {
    Write-Host "Bỏ qua bước screenshot theo yêu cầu." -ForegroundColor Yellow
}

Write-Section 'Hoàn tất'
Write-Host 'Tất cả bước đã hoàn thành thành công.' -ForegroundColor Green
