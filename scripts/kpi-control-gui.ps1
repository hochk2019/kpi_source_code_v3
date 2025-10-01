[CmdletBinding()]
param(
    [string]$Port = "5000",
    [switch]$AutoStart
)

function Stop-DueToMissingPrerequisite {
    param(
        [string]$Reason,
        [string[]]$Guidance = @()
    )

    Write-Host "" # tạo khoảng trắng để dễ đọc
    Write-Host "❌ $Reason" -ForegroundColor Red
    if ($Guidance -and $Guidance.Count -gt 0) {
        Write-Host "Hướng dẫn khắc phục:" -ForegroundColor Yellow
        foreach ($item in $Guidance) {
            Write-Host "  - $item"
        }
    }
    exit 1
}

function Assert-DesktopPowerShell {
    if (-not $IsWindows) {
        Stop-DueToMissingPrerequisite -Reason 'Script giao diện cần chạy trên Windows vì phụ thuộc WPF.' -Guidance @(
            'Hãy chạy file này bằng PowerShell trên Windows 10/11 thay vì môi trường Linux/WSL.',
            'Nếu đang dùng máy ảo hoặc container, hãy chuyển sang PowerShell trên máy Windows chính.'
        )
    }

    if ($PSVersionTable.PSVersion.Major -lt 5) {
        Stop-DueToMissingPrerequisite -Reason "Phiên bản PowerShell $($PSVersionTable.PSVersion) quá cũ để khởi tạo WPF." -Guidance @(
            'Cài Windows PowerShell 5.1 (mặc định trên Windows) hoặc PowerShell 7 trở lên.',
            'Có thể cài nhanh bằng: winget install Microsoft.PowerShell -s winget.'
        )
    }
}

function Assert-WpfAssemblies {
    $assemblies = @('PresentationFramework', 'PresentationCore')

    foreach ($assembly in $assemblies) {
        try {
            Add-Type -AssemblyName $assembly -ErrorAction Stop | Out-Null
        } catch {
            Stop-DueToMissingPrerequisite -Reason "Không thể nạp thư viện WPF '$assembly': $($_.Exception.Message)" -Guidance @(
                'Bật .NET Framework 4.8 trong Control Panel -> Turn Windows features on or off.',
                'Hoặc cài .NET Desktop Runtime: winget install Microsoft.DotNet.DesktopRuntime.7 hoặc tải từ https://aka.ms/dotnet-desktop-runtime.',
                'Khởi động lại PowerShell sau khi cài đặt rồi chạy lại script.'
            )
        }
    }
}

function Assert-PnpmEnvironment {
    $pnpm = Get-Command 'pnpm.cmd' -ErrorAction SilentlyContinue
    if (-not $pnpm) {
        Stop-DueToMissingPrerequisite -Reason "Không tìm thấy 'pnpm.cmd' trong PATH." -Guidance @(
            'Cài Node.js LTS từ https://nodejs.org/ hoặc dùng winget install OpenJS.NodeJS.LTS.',
            'Sau khi có Node.js, bật pnpm bằng lệnh: corepack enable pnpm (PowerShell 5+) hoặc npm install -g pnpm.',
            'Đóng và mở lại PowerShell (hoặc logoff/login) để biến PATH được cập nhật.'
        )
    }

    $node = Get-Command 'node' -ErrorAction SilentlyContinue
    if (-not $node) {
        Stop-DueToMissingPrerequisite -Reason "Không tìm thấy 'node' (Node.js) trong PATH." -Guidance @(
            'Tải và cài Node.js bản LTS từ https://nodejs.org/ hoặc chạy winget install OpenJS.NodeJS.LTS.',
            'Trong quá trình cài đặt nhớ chọn tùy chọn thêm Node vào PATH.',
            'Khởi động lại PowerShell rồi chạy lại script sau khi cài đặt hoàn tất.'
        )
    }
}

Assert-DesktopPowerShell
Assert-WpfAssemblies
Assert-PnpmEnvironment

$script:RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$script:CurrentPort = $Port
$script:ServerProcess = $null
$script:StatusHistory = @()
$script:Ui = @{}

function Write-Log {
    param([string]$Message)
    $timestamp = (Get-Date).ToString('HH:mm:ss')
    $entry = "[$timestamp] $Message"
    $script:StatusHistory = ($script:StatusHistory + $entry) | Select-Object -Last 12
    if ($script:Ui.LogText) {
        $script:Ui.LogText.Text = ($script:StatusHistory -join "`n")
    }
}

function Get-ServerRunning {
    if (-not $script:ServerProcess) { return $false }
    if ($script:ServerProcess.HasExited) { return $false }
    try {
        [System.Diagnostics.Process]::GetProcessById($script:ServerProcess.Id) | Out-Null
        return $true
    } catch {
        return $false
    }
}

function Update-StatusText {
    if ($script:Ui.StatusText) {
        if (Get-ServerRunning) {
            $script:Ui.StatusText.Text = "Trạng thái: Đang chạy (PID $($script:ServerProcess.Id))"
        } else {
            $script:Ui.StatusText.Text = "Trạng thái: Đã dừng"
        }
    }
    if ($script:Ui.PortText) {
        $script:Ui.PortText.Text = "Port hiện tại: $script:CurrentPort"
    }
    if ($script:Ui.ToggleAutostartButton) {
        if (Test-AutostartEnabled) {
            $script:Ui.ToggleAutostartButton.Content = "Tắt khởi động cùng Windows"
            if ($script:Ui.AutostartText) { $script:Ui.AutostartText.Text = "Tự khởi động: Đang bật" }
        } else {
            $script:Ui.ToggleAutostartButton.Content = "Bật khởi động cùng Windows"
            if ($script:Ui.AutostartText) { $script:Ui.AutostartText.Text = "Tự khởi động: Đang tắt" }
        }
    }
}

function Start-KpiServer {
    if (Get-ServerRunning) {
        Write-Log "Máy chủ KPI đã chạy."
        return
    }
    $startInfo = New-Object System.Diagnostics.ProcessStartInfo
    $startInfo.FileName = 'pnpm.cmd'
    $startInfo.Arguments = 'server'
    $startInfo.WorkingDirectory = $script:RepoRoot
    $startInfo.UseShellExecute = $false
    $startInfo.CreateNoWindow = $true
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $startInfo.EnvironmentVariables['PORT'] = $script:CurrentPort
    try {
        $proc = New-Object System.Diagnostics.Process
        $proc.StartInfo = $startInfo
        $null = $proc.Start()
        $proc.BeginOutputReadLine()
        $proc.BeginErrorReadLine()
        $outputHandler = [System.Diagnostics.DataReceivedEventHandler]{ param($sender, $args) if ($args.Data) { Write-Log $args.Data } }
        $proc.add_OutputDataReceived($outputHandler)
        $proc.add_ErrorDataReceived($outputHandler)
        $proc.EnableRaisingEvents = $true
        $proc.add_Exited({ Write-Log "Máy chủ KPI đã dừng."; Update-StatusText })
        $script:ServerProcess = $proc
        Write-Log "Đã khởi động server KPI (PID $($proc.Id)) trên port $($script:CurrentPort)."
    } catch {
        Write-Log "Không thể khởi động server KPI: $($_.Exception.Message)"
    }
    Update-StatusText
}

function Stop-KpiServer {
    if (-not (Get-ServerRunning)) {
        Write-Log "Máy chủ KPI đang không chạy."
        return
    }
    try {
        Stop-Process -Id $script:ServerProcess.Id -Force -ErrorAction Stop
        Write-Log "Đã tắt server KPI."
    } catch {
        Write-Log "Không thể tắt server KPI: $($_.Exception.Message)"
    }
    $script:ServerProcess = $null
    Update-StatusText
}

function Restart-KpiServer {
    Stop-KpiServer
    Start-Sleep -Seconds 1
    Start-KpiServer
}

function Reset-KpiServer {
    Stop-KpiServer
    try {
        Write-Log "Đang chạy pnpm server:rebuild..."
        $result = Start-Process -FilePath 'pnpm.cmd' -ArgumentList 'server:rebuild' -WorkingDirectory $script:RepoRoot -NoNewWindow -Wait -PassThru
        Write-Log "Hoàn tất pnpm server:rebuild (ExitCode $($result.ExitCode))."
    } catch {
        Write-Log "Không thể rebuild backend: $($_.Exception.Message)"
    }
    Start-KpiServer
}

function Pause-KpiServer {
    if (-not (Get-ServerRunning)) { Write-Log "Máy chủ chưa chạy."; return }
    try {
        Suspend-Process -Id $script:ServerProcess.Id -ErrorAction Stop
        Write-Log "Đã tạm dừng tiến trình KPI."
    } catch {
        Write-Log "Không thể tạm dừng: $($_.Exception.Message)"
    }
}

function Resume-KpiServer {
    if (-not (Get-ServerRunning)) { Write-Log "Máy chủ chưa chạy."; return }
    try {
        Resume-Process -Id $script:ServerProcess.Id -ErrorAction Stop
        Write-Log "Đã tiếp tục tiến trình KPI."
    } catch {
        Write-Log "Không thể tiếp tục: $($_.Exception.Message)"
    }
}

function Set-KpiPort {
    param([string]$NewPort)
    if (-not $NewPort) { return }
    $clean = ($NewPort -replace '\D', '')
    if (-not $clean) {
        Write-Log "Port không hợp lệ."; return
    }
    $script:CurrentPort = $clean
    if ($script:Ui.PortInput) { $script:Ui.PortInput.Text = $clean }
    Write-Log "Đã cập nhật port mặc định thành $clean."
    Update-StatusText
}

function Get-AutostartTaskName { return 'KPI-Autostart-Server' }

function Test-AutostartEnabled {
    $task = Get-ScheduledTask -TaskName (Get-AutostartTaskName) -ErrorAction SilentlyContinue
    return $null -ne $task
}

function Enable-Autostart {
    $taskName = Get-AutostartTaskName
    $scriptPath = (Resolve-Path $MyInvocation.MyCommand.Path).Path
    $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$scriptPath`" -AutoStart -Port $script:CurrentPort"
    $trigger = New-ScheduledTaskTrigger -AtLogOn
    try {
        Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Description 'Khởi động KPI server cùng Windows' -Force | Out-Null
        Write-Log "Đã bật khởi động cùng Windows."
    } catch {
        Write-Log "Không thể bật auto start: $($_.Exception.Message)"
    }
    Update-StatusText
}

function Disable-Autostart {
    $taskName = Get-AutostartTaskName
    try {
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction Stop
        Write-Log "Đã tắt khởi động cùng Windows."
    } catch {
        Write-Log "Không thể tắt auto start: $($_.Exception.Message)"
    }
    Update-StatusText
}

if ($AutoStart) {
    Start-KpiServer
    Start-Sleep -Seconds 5
    return
}

$portBoxInitial = $script:CurrentPort

$xaml = @"
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Trình điều khiển KPI" Height="420" Width="640" WindowStartupLocation="CenterScreen">
  <Grid Margin="16">
    <Grid.RowDefinitions>
      <RowDefinition Height="Auto" />
      <RowDefinition Height="Auto" />
      <RowDefinition Height="Auto" />
      <RowDefinition Height="*" />
    </Grid.RowDefinitions>

    <StackPanel Grid.Row="0" Margin="0,0,0,8">
      <TextBlock x:Name="StatusText" FontSize="16" FontWeight="SemiBold" Text="Trạng thái: Chưa kiểm tra" />
      <TextBlock x:Name="PortText" FontSize="13" Text="Port hiện tại: $portBoxInitial" Margin="0,4,0,0" />
      <TextBlock x:Name="AutostartText" FontSize="13" Text="Tự khởi động: Chưa xác định" />
    </StackPanel>

    <WrapPanel Grid.Row="1" Margin="0,4,0,8">
      <Button x:Name="StartButton" Content="Khởi động hệ thống" Width="170" Margin="4" />
      <Button x:Name="PauseButton" Content="Tạm ngừng" Width="120" Margin="4" />
      <Button x:Name="ResumeButton" Content="Tiếp tục" Width="120" Margin="4" />
      <Button x:Name="ResetButton" Content="Reset hệ thống" Width="140" Margin="4" />
      <Button x:Name="RestartButton" Content="Khởi động lại" Width="140" Margin="4" />
      <Button x:Name="ShutdownButton" Content="Shutdown" Width="120" Margin="4" />
    </WrapPanel>

    <StackPanel Grid.Row="2" Orientation="Horizontal" Margin="0,4,0,12" VerticalAlignment="Center">
      <TextBlock Text="Port:" VerticalAlignment="Center" Margin="0,0,8,0" />
      <TextBox x:Name="PortInput" Width="100" Text="$portBoxInitial" Margin="0,0,8,0" />
      <Button x:Name="ChangePortButton" Content="Đổi port" Width="100" Margin="0,0,8,0" />
      <Button x:Name="RefreshStatusButton" Content="Làm mới trạng thái" Width="160" />
    </StackPanel>

    <StackPanel Grid.Row="3">
      <Button x:Name="ToggleAutostartButton" Content="Bật khởi động cùng Windows" Width="220" Margin="0,0,0,8" />
      <TextBlock x:Name="LogText" TextWrapping="Wrap" Height="140" Background="#111827" Foreground="White" Padding="8" />
    </StackPanel>
  </Grid>
</Window>
"@

$reader = [System.Xml.XmlReader]::Create([System.IO.StringReader]$xaml)
$window = [Windows.Markup.XamlReader]::Load($reader)

$script:Ui.StatusText = $window.FindName('StatusText')
$script:Ui.PortText = $window.FindName('PortText')
$script:Ui.AutostartText = $window.FindName('AutostartText')
$script:Ui.LogText = $window.FindName('LogText')
$script:Ui.PortInput = $window.FindName('PortInput')
$script:Ui.ToggleAutostartButton = $window.FindName('ToggleAutostartButton')

$window.FindName('StartButton').Add_Click({ Start-KpiServer })
$window.FindName('PauseButton').Add_Click({ Pause-KpiServer })
$window.FindName('ResumeButton').Add_Click({ Resume-KpiServer })
$window.FindName('ResetButton').Add_Click({ Reset-KpiServer })
$window.FindName('RestartButton').Add_Click({ Restart-KpiServer })
$window.FindName('ShutdownButton').Add_Click({ Stop-KpiServer })
$window.FindName('ChangePortButton').Add_Click({
    $value = $script:Ui.PortInput.Text
    $running = Get-ServerRunning
    Set-KpiPort -NewPort $value
    if ($running) {
        Write-Log "Khởi động lại server với port mới."
        Restart-KpiServer
    }
})
$window.FindName('RefreshStatusButton').Add_Click({ Update-StatusText })
$window.FindName('ToggleAutostartButton').Add_Click({
    if (Test-AutostartEnabled) { Disable-Autostart } else { Enable-Autostart }
})

Update-StatusText
Write-Log "Sẵn sàng." 
$window.ShowDialog() | Out-Null
