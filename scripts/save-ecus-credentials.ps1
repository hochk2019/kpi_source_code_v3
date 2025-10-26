param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$Server,
    [Parameter(Mandatory = $true)][string]$Database,
    [Parameter(Mandatory = $true)][string]$User,
    [Parameter(Mandatory = $true)][string]$Password
)

$normalizedServer = $Server.Trim()
$normalizedDatabase = $Database.Trim()
$normalizedUser = $User.Trim()

if ([string]::IsNullOrWhiteSpace($normalizedServer)) {
    throw 'Server không được để trống.'
}

if ([string]::IsNullOrWhiteSpace($normalizedDatabase)) {
    throw 'Database không được để trống.'
}

if ([string]::IsNullOrWhiteSpace($normalizedUser)) {
    throw 'User không được để trống.'
}

$payload = @{
    server   = $normalizedServer
    database = $normalizedDatabase
    user     = $normalizedUser
    password = $Password
} | ConvertTo-Json -Compress

$secureString = ConvertTo-SecureString -String $payload -AsPlainText -Force
$encrypted = ConvertFrom-SecureString -SecureString $secureString

$directory = Split-Path -Parent $Path
if (-not [string]::IsNullOrWhiteSpace($directory) -and -not (Test-Path -LiteralPath $directory)) {
    New-Item -ItemType Directory -Path $directory -Force | Out-Null
}

Set-Content -LiteralPath $Path -Value $encrypted -Encoding UTF8

Write-Output "Đã lưu thông tin đăng nhập ECUS tại $Path bằng DPAPI (CurrentUser)."
