param(
    [Parameter(Mandatory = $true)][string]$Path
)

if (-not (Test-Path -LiteralPath $Path)) {
    Write-Error "Không tìm thấy file lưu thông tin ECUS: $Path"
    exit 2
}

try {
    $encrypted = Get-Content -LiteralPath $Path -Raw -Encoding UTF8
    if ([string]::IsNullOrWhiteSpace($encrypted)) {
        Write-Error "File ECUS rỗng: $Path"
        exit 3
    }

    $secure = ConvertTo-SecureString -String $encrypted
    $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try {
        $json = [System.Runtime.InteropServices.Marshal]::PtrToStringUni($bstr)
    }
    finally {
        [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }

    Write-Output $json
    exit 0
}
catch {
    Write-Error $_.Exception.Message
    exit 1
}
