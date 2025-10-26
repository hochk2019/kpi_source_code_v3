Param(
    [string]$DnsName = 'localhost',
    [string]$OutDir = (Join-Path (Get-Location) 'config'),
    [int]$ValidDays = 730,
    [string]$Password = 'ChangeMe!123'
)

function Convert-ToPem {
    Param(
        [Parameter(Mandatory = $true)][string]$Label,
        [Parameter(Mandatory = $true)][byte[]]$Bytes
    )

    $base64 = [System.Convert]::ToBase64String($Bytes)
    $builder = New-Object System.Text.StringBuilder
    $builder.AppendLine("-----BEGIN $Label-----") | Out-Null
    for ($i = 0; $i -lt $base64.Length; $i += 64) {
        $length = [System.Math]::Min(64, $base64.Length - $i)
        $builder.AppendLine($base64.Substring($i, $length)) | Out-Null
    }
    $builder.AppendLine("-----END $Label-----") | Out-Null
    return $builder.ToString()
}

if (-not (Test-Path -Path $OutDir)) {
    New-Item -ItemType Directory -Path $OutDir -Force | Out-Null
}

$notAfter = (Get-Date).AddDays($ValidDays)
$cert = New-SelfSignedCertificate \
    -DnsName $DnsName \
    -CertStoreLocation 'Cert:\\CurrentUser\\My' \
    -FriendlyName 'KPI AI Internal HTTPS' \
    -KeyAlgorithm RSA \
    -KeyLength 4096 \
    -KeyExportPolicy Exportable \
    -NotAfter $notAfter

if (-not $cert) {
    throw 'Không thể tạo chứng chỉ tự ký.'
}

$securePassword = ConvertTo-SecureString -String $Password -Force -AsPlainText
$pfxPath = Join-Path $OutDir 'ai-https.pfx'
$certPath = "Cert:\\CurrentUser\\My\\$($cert.Thumbprint)"
Export-PfxCertificate -Cert $certPath -FilePath $pfxPath -Password $securePassword -Force | Out-Null

$certData = [System.IO.File]::ReadAllBytes($pfxPath)
$x509 = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2
$x509.Import($certData, $Password, 'Exportable,PersistKeySet')

$privateKey = $x509.GetRSAPrivateKey()
if (-not $privateKey) {
    throw 'Không thể đọc private key từ chứng chỉ vừa tạo.'
}

$privateKeyPem = Convert-ToPem -Label 'PRIVATE KEY' -Bytes ($privateKey.ExportPkcs8PrivateKey())
$certPem = Convert-ToPem -Label 'CERTIFICATE' -Bytes ($x509.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert))

$keyFile = Join-Path $OutDir 'ai-https.key'
$certFile = Join-Path $OutDir 'ai-https.crt'
$caFile = Join-Path $OutDir 'ai-https.ca.pem'

Set-Content -Path $keyFile -Value $privateKeyPem -Encoding ascii
Set-Content -Path $certFile -Value $certPem -Encoding ascii
Set-Content -Path $caFile -Value $certPem -Encoding ascii

Write-Host "Đã tạo chứng chỉ AI HTTPS nội bộ:" -ForegroundColor Green
Write-Host " - Private key: $keyFile"
Write-Host " - Certificate: $certFile"
Write-Host " - CA bundle: $caFile"
Write-Host " - PFX (dự phòng): $pfxPath"
Write-Host 'Hãy cài đặt chứng chỉ CA trên các máy trạm cần truy cập kênh HTTPS nội bộ.'
