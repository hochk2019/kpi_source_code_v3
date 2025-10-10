#!/usr/bin/env pwsh
[CmdletBinding()]
param(
    [Parameter(ValueFromPipelineByPropertyName = $true)]
    [string]$Endpoint = "http://localhost:3000/api/internal/monitor/ecus-sync",

    [Parameter(ValueFromPipelineByPropertyName = $true)]
    [string]$MonitorToken = $env:MONITOR_ACCESS_TOKEN,

    [Parameter(ValueFromPipelineByPropertyName = $true)]
    [int]$TimeoutSeconds = 20,

    [Parameter(ValueFromPipelineByPropertyName = $true)]
    [string]$EventSource = "KPI.ECUS.Monitor",

    [Parameter(ValueFromPipelineByPropertyName = $true)]
    [string]$EventLogName = "Application",

    [Parameter(ValueFromPipelineByPropertyName = $true)]
    [string]$FallbackLogPath = (Join-Path $PSScriptRoot 'monitor-ecus-sync.log'),

    [switch]$SkipEventLog
)

# Đảm bảo thông báo Unicode hiển thị đúng trong PowerShell 7
try {
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
} catch {
    # Bỏ qua nếu không thể thiết lập encoding
}

function Write-MonitorLog {
    param(
        [ValidateSet('Information', 'Warning', 'Error')]
        [string]$Level,
        [string]$Message,
        [int]$EventId = 1200
    )

    $timestamp = (Get-Date).ToString('s')
    $logLine = "[$timestamp][$Level] $Message"
    Write-Output $logLine

    if (-not $SkipEventLog) {
        try {
            if (-not [System.Diagnostics.EventLog]::SourceExists($EventSource)) {
                New-EventLog -LogName $EventLogName -Source $EventSource -ErrorAction Stop | Out-Null
            }

            Write-EventLog -LogName $EventLogName -Source $EventSource -EntryType $Level -EventId $EventId -Message $Message -ErrorAction Stop
            return
        } catch {
            Write-Warning "Không thể ghi Event Viewer: $($_.Exception.Message). Sẽ ghi vào file thay thế."
        }
    }

    if ($FallbackLogPath) {
        try {
            Add-Content -Path $FallbackLogPath -Value $logLine
        } catch {
            Write-Warning "Không thể ghi log dự phòng: $($_.Exception.Message)"
        }
    }
}

if (-not $MonitorToken) {
    Write-MonitorLog -Level Error -Message 'Chưa cấu hình MONITOR_ACCESS_TOKEN cho script giám sát.' -EventId 1201
    exit 2
}

try {
    $headers = @{ 'x-monitor-token' = $MonitorToken }
    $invokeParams = @{
        Uri         = $Endpoint
        Headers     = $headers
        TimeoutSec  = $TimeoutSeconds
        Method      = 'GET'
        ErrorAction = 'Stop'
        UseBasicParsing = $true
    }

    $response = Invoke-WebRequest @invokeParams
    $payload = $response.Content | ConvertFrom-Json -ErrorAction Stop

    if (-not $payload.ok) {
        $message = "API trả về trạng thái lỗi: $($payload.error)"
        Write-MonitorLog -Level Error -Message $message -EventId 1202
        exit 1
    }

    $snapshot = $payload.snapshot
    if (-not $snapshot) {
        Write-MonitorLog -Level Warning -Message 'API không trả về dữ liệu snapshot.' -EventId 1203
        exit 1
    }

    $severity = $snapshot.severity
    switch ($severity) {
        'critical' { $entryType = 'Error' }
        'warning' { $entryType = 'Warning' }
        default { $entryType = 'Information' }
    }

    $sync = $snapshot.sync
    $database = $snapshot.database
    $issues = $snapshot.issues -join '; '

    $details = @()
    if ($sync.lastRunAt) { $details += "Lần chạy gần nhất: $($sync.lastRunAt)" }
    if ($sync.staleMinutes -ne $null) { $details += "Độ trễ: $($sync.staleMinutes) phút" }
    if ($sync.rowsInserted -ne $null) { $details += "Bản ghi mới: $($sync.rowsInserted)" }
    if ($sync.rowsUpdated -ne $null) { $details += "Bản ghi cập nhật: $($sync.rowsUpdated)" }
    if ($database.server) { $details += "SQL Server: $($database.server)" }
    if ($database.state) { $details += "Trạng thái SQL: $($database.state)" }
    if ($issues) { $details += "Cảnh báo: $issues" }

    $message = if ($details.Count -gt 0) { $details -join " | " } else { 'Không có dữ liệu chi tiết.' }
    Write-MonitorLog -Level $entryType -Message $message -EventId 1204
    exit 0
} catch {
    $errorMessage = "Lỗi khi kiểm tra trạng thái đồng bộ ECUS: $($_.Exception.Message)"
    Write-MonitorLog -Level Error -Message $errorMessage -EventId 1299
    exit 1
}
