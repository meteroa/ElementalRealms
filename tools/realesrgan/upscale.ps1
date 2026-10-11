param (
    [string]$InputPath,
    [string]$OutputPath,
    [string]$InputDir,
    [string]$OutputDir,
    [string]$Model = "realesrgan-x4plus-anime",
    [int]$Scale = 4
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$exe = Join-Path $scriptDir "realesrgan-ncnn-vulkan.exe"

if (-not (Test-Path $exe)) {
    Write-Error "realesrgan-ncnn-vulkan.exe not found at $exe"
    exit 1
}

# Single file mode
if ($InputPath) {
    if (-not (Test-Path $InputPath)) {
        Write-Error "Input file not found: $InputPath"
        exit 1
    }
    if (-not $OutputPath) {
        $dir = Split-Path -Parent $InputPath
        $base = [System.IO.Path]::GetFileNameWithoutExtension($InputPath)
        $OutputPath = Join-Path $dir "${base}_4k.png"
    }
    $outDir = Split-Path -Parent $OutputPath
    if ($outDir -and (-not (Test-Path $outDir))) {
        New-Item -ItemType Directory -Force -Path $outDir | Out-Null
    }
    Write-Host "[Upscaler] Processing $InputPath -> $OutputPath (Model: $Model, Scale: ${Scale}x)..." -ForegroundColor Cyan
    & $exe -i $InputPath -o $OutputPath -n $Model -s $Scale
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[Upscaler] Success: $OutputPath" -ForegroundColor Green
    } else {
        Write-Error "[Upscaler] Failed with exit code $LASTEXITCODE"
    }
    exit $LASTEXITCODE
}

# Batch directory mode
if ($InputDir) {
    if (-not (Test-Path $InputDir)) {
        Write-Error "Input directory not found: $InputDir"
        exit 1
    }
    if (-not $OutputDir) {
        $OutputDir = "${InputDir}_hd"
    }
    if (-not (Test-Path $OutputDir)) {
        New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
    }
    Write-Host "[Upscaler] Batch processing $InputDir -> $OutputDir (Model: $Model)..." -ForegroundColor Cyan
    & $exe -i $InputDir -o $OutputDir -n $Model -s $Scale
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[Upscaler] Batch processing complete!" -ForegroundColor Green
    } else {
        Write-Error "[Upscaler] Batch processing failed with exit code $LASTEXITCODE"
    }
    exit $LASTEXITCODE
}

Write-Host "Usage:"
Write-Host "  Single: .\upscale.ps1 -InputPath 'path\to\card.jpg' -OutputPath 'path\to\card_hd.png'"
Write-Host "  Batch:  .\upscale.ps1 -InputDir 'pc\Images\Cards' -OutputDir 'android\public\cards_hd'"
