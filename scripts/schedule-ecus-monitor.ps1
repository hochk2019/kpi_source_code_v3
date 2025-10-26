#!/usr/bin/env pwsh
<##
.SYNOPSIS
    Đăng ký (hoặc gỡ bỏ) tác vụ Windows Task Scheduler giám sát đồng bộ ECUS.
.DESCRIPTION
    Script tạo tác vụ định kỳ chạy `monitor-ecus-sync.ps1` để gọi API `/api/internal/monitor/ecus-sync`.
    Khi phát hiện lỗi hoặc độ trễ lớn, backend sẽ tự gửi email/slack theo cấu hình webhook hiện hành.
    Phù hợp với Windows 11 Pro + PowerShell 7 trên máy chủ chạy KPI Source Code.
.PARAMETER TaskName
    Tên tác vụ trong Task Scheduler. Mặc định: KPI.ECUS.Monitor
.PARAMETER ScriptPath
    Đường dẫn tới `monitor-ecus-sync.ps1`. Mặc định: cùng thư mục `scripts` của dự án.
.PARAMETER MonitorToken
    Token dùng cho header `x-monitor-token`. Nếu bỏ trống sẽ dùng biến môi trường `MONITOR_ACCESS_TOKEN`.
.PARAMETER IntervalMinutes
    Chu kỳ chạy (phút). Giá trị tối thiểu 5 phút để tránh spam cảnh báo.
.PARAMETER WorkingDirectory
    Thư mục làm việc khi gọi script. Mặc định: thư mục gốc repository.
.PARAMETER Remove
    Nếu đặt cờ này, script sẽ gỡ bỏ tác vụ đã đăng ký và thoát.
.PARAMETER RegisterOnly
    Đăng ký tác vụ nhưng không kích hoạt chạy ngay lần đầu.
.EXAMPLE
    ./scripts/schedule-ecus-monitor.ps1 -MonitorToken 'secret-token'
.EXAMPLE
    ./scripts/schedule-ecus-monitor.ps1 -Remove
.NOTES
    - Yêu cầu chạy với quyền quản trị viên để đăng ký tác vụ hệ thống.
    - Task được đặt chạy bằng tài khoản SYSTEM và không hiển thị cửa sổ.
##>
[CmdletBinding()]
param(
    [string]$TaskName = 'KPI.ECUS.Monitor',
    [string]$ScriptPath = (Join-Path -Path $PSScriptRoot -ChildPath 'monitor-ecus-sync.ps1'),
    [string]$MonitorToken = $env:MONITOR_ACCESS_TOKEN,
    [ValidateRange(5, 1440)]
    [int]$IntervalMinutes = 5,
    [string]$WorkingDirectory = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
    [switch]$Remove,
    [switch]$RegisterOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ($Remove) {
    try {
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction Stop
        Write-Host "Đã gỡ tác vụ $TaskName." -ForegroundColor Green
    } catch {
        Write-Warning "Không thể gỡ tác vụ $TaskName: $($_.Exception.Message)"
    }
    return
}

if (-not (Test-Path $ScriptPath -PathType Leaf)) {
    throw "Không tìm thấy monitor script tại: $ScriptPath"
}

if (-not $MonitorToken) {
    Write-Warning 'Chưa cung cấp MONITOR_ACCESS_TOKEN. Tác vụ vẫn được đăng ký nhưng script sẽ báo lỗi khi chạy.'
}

$escapedScript = '"' + $ScriptPath + '"'
$actionArguments = "-NoLogo -NoProfile -ExecutionPolicy Bypass -File $escapedScript"
if ($MonitorToken) {
    $actionArguments += " -MonitorToken '$MonitorToken'"
}

$action = New-ScheduledTaskAction -Execute 'pwsh.exe' -Argument $actionArguments -WorkingDirectory $WorkingDirectory
$trigger = New-ScheduledTaskTrigger -Once (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes $IntervalMinutes) -RepetitionDuration ([TimeSpan]::MaxValue)
$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest

$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew -StartWhenAvailable

try {
    Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
    Write-Host "Đã đăng ký tác vụ $TaskName chạy mỗi $IntervalMinutes phút." -ForegroundColor Green
    if (-not $RegisterOnly) {
        Start-ScheduledTask -TaskName $TaskName
        Write-Host 'Đã kích hoạt chạy ngay lần đầu.' -ForegroundColor Cyan
    } else {
        Write-Host 'Bỏ qua chạy ngay theo yêu cầu.' -ForegroundColor Yellow
    }
} catch {
    throw "Không thể đăng ký tác vụ: $($_.Exception.Message)"
}
