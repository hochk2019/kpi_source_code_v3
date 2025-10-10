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

    [Parameter(ValueFromPipelineByPropertyName = $true)]
    [string]$JsonLogPath = (Join-Path $PSScriptRoot 'monitor-ecus-sync.jsonl'),

    [switch]$SkipEventLog
)

# Đảm bảo thông báo Unicode hiển thị đúng trong PowerShell 7
try {
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
} catch {
    # Bỏ qua nếu không thể thiết lập encoding
}

function Write-MonitorJson {
    param(
        [Parameter(Mandatory = $true)]
        [hashtable]$Payload
    )

    if (-not $JsonLogPath) {
        return
    }

    try {
        $jsonLine = $Payload | ConvertTo-Json -Depth 6 -Compress
        Add-Content -Path $JsonLogPath -Value $jsonLine
    } catch {
        Write-Warning "Không thể ghi log JSON: $($_.Exception.Message)"
    }
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
        Write-MonitorJson -Payload ([ordered]@{
            timestamp = (Get-Date).ToString('o')
            severity  = 'error'
            status    = 'api_error'
            error     = $payload.error
        })
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
    $alertState = $snapshot.alertState
    if ($alertState) {
        if ($alertState.consecutiveErrors -gt 0) {
            $details += "Lỗi liên tiếp: $($alertState.consecutiveErrors)"
        }
        if ($alertState.lastAlertDeliveredAt) {
            $details += "Cảnh báo gần nhất: $($alertState.lastAlertDeliveredAt)"
        }
        $dispatch = $snapshot.alertDispatch
        if ($dispatch -and $dispatch.triggered -and $dispatch.triggered.Count -gt 0) {
            $details += "Cảnh báo mới gửi: $($dispatch.triggered -join ', ')"
        }
    }
    if ($issues) { $details += "Cảnh báo: $issues" }

    $message = if ($details.Count -gt 0) { $details -join " | " } else { 'Không có dữ liệu chi tiết.' }
    Write-MonitorLog -Level $entryType -Message $message -EventId 1204

    Write-MonitorJson -Payload ([ordered]@{
            timestamp = (Get-Date).ToString('o')
            severity  = $severity
            status    = $sync.lastStatus
            staleMinutes = $sync.staleMinutes
            lastRunAt = $sync.lastRunAt
            rowsFetched = $sync.rowsFetched
            rowsInserted = $sync.rowsInserted
            rowsUpdated = $sync.rowsUpdated
            rowsSkipped = $sync.rowsSkipped
            totalStored = $sync.totalStored
            issues    = $snapshot.issues
            alert     = if ($alertState) {
                [ordered]@{
                    consecutiveErrors      = $alertState.consecutiveErrors
                    lastSuccessAt           = $alertState.lastSuccessAt
                    lastFailureAlertAt      = $alertState.lastFailureAlertAt
                    lastStaleAlertAt        = $alertState.lastStaleAlertAt
                    lastAlertDeliveredAt    = $alertState.lastAlertDeliveredAt
                    triggered               = $snapshot.alertDispatch.triggered
                }
            } else { $null }
            database = $database
        })
    exit 0
} catch {
    $errorMessage = "Lỗi khi kiểm tra trạng thái đồng bộ ECUS: $($_.Exception.Message)"
    Write-MonitorLog -Level Error -Message $errorMessage -EventId 1299
    Write-MonitorJson -Payload ([ordered]@{
            timestamp = (Get-Date).ToString('o')
            severity  = 'error'
            status    = 'exception'
            error     = $_.Exception.Message
        })
    exit 1
}
