$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$releaseDir = Join-Path $root "release"
$outDir = Join-Path $releaseDir "chrome-store-assets"
$screensDir = Join-Path $outDir "screenshots"
$promoDir = Join-Path $outDir "promo"

New-Item -ItemType Directory -Force $screensDir | Out-Null
New-Item -ItemType Directory -Force $promoDir | Out-Null

$fontTitle = New-Object System.Drawing.Font("Segoe UI", 38, [System.Drawing.FontStyle]::Bold)
$fontSub = New-Object System.Drawing.Font("Segoe UI", 20, [System.Drawing.FontStyle]::Regular)
$fontLabel = New-Object System.Drawing.Font("Segoe UI", 18, [System.Drawing.FontStyle]::Regular)
$fontPromoTitle = New-Object System.Drawing.Font("Segoe UI", 20, [System.Drawing.FontStyle]::Bold)
$fontPromoSub = New-Object System.Drawing.Font("Segoe UI", 13, [System.Drawing.FontStyle]::Regular)
$fontSmallLabel = New-Object System.Drawing.Font("Segoe UI", 16, [System.Drawing.FontStyle]::Regular)
$fontHeroTitle = New-Object System.Drawing.Font("Segoe UI", 48, [System.Drawing.FontStyle]::Bold)
$fontHeroSub = New-Object System.Drawing.Font("Segoe UI", 24, [System.Drawing.FontStyle]::Regular)

$brushInk = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(15, 23, 42))
$brushMuted = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(71, 85, 105))
$brushBlue = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(79, 70, 229))
$brushLight = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(248, 250, 252))
$penFrame = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(203, 213, 225), 2)
$penSoft = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(226, 232, 240), 1)

function New-StoreBitmap($width, $height) {
  return New-Object System.Drawing.Bitmap($width, $height, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
}

function Fill-Background($graphics, $width, $height) {
  $rect = New-Object System.Drawing.Rectangle(0, 0, $width, $height)
  $bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    $rect,
    [System.Drawing.Color]::FromArgb(246, 248, 252),
    [System.Drawing.Color]::FromArgb(226, 232, 240),
    [System.Drawing.Drawing2D.LinearGradientMode]::ForwardDiagonal
  )
  $graphics.FillRectangle($bg, $rect)
  $bg.Dispose()
}

function Draw-RoundedRectangle($graphics, $brush, $pen, $x, $y, $width, $height, $radius) {
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $diameter = $radius * 2
  $path.AddArc($x, $y, $diameter, $diameter, 180, 90)
  $path.AddArc($x + $width - $diameter, $y, $diameter, $diameter, 270, 90)
  $path.AddArc($x + $width - $diameter, $y + $height - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($x, $y + $height - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  if ($brush) { $graphics.FillPath($brush, $path) }
  if ($pen) { $graphics.DrawPath($pen, $path) }
  $path.Dispose()
}

function Draw-TextBlock($graphics, $title, $subtitle, $x, $y, $titleFont, $subtitleFont) {
  $graphics.DrawString($title, $titleFont, $script:brushInk, $x, $y)
  $graphics.DrawString($subtitle, $subtitleFont, $script:brushMuted, $x, $y + [int]($titleFont.Size * 1.55))
}

function Draw-TextBlockInRect($graphics, $title, $subtitle, $x, $y, $width, $titleHeight, $subtitleHeight, $titleFont, $subtitleFont) {
  $titleRect = New-Object System.Drawing.RectangleF($x, $y, $width, $titleHeight)
  $subtitleRect = New-Object System.Drawing.RectangleF($x, ($y + $titleHeight + 8), $width, $subtitleHeight)
  $format = New-Object System.Drawing.StringFormat
  $format.Trimming = [System.Drawing.StringTrimming]::EllipsisWord
  $format.FormatFlags = [System.Drawing.StringFormatFlags]::LineLimit
  $graphics.DrawString($title, $titleFont, $script:brushInk, $titleRect, $format)
  $graphics.DrawString($subtitle, $subtitleFont, $script:brushMuted, $subtitleRect, $format)
  $format.Dispose()
}

function Draw-ImageCard($graphics, $sourcePath, $x, $y, $maxWidth, $maxHeight) {
  $src = [System.Drawing.Image]::FromFile($sourcePath)
  try {
    $scale = [Math]::Min($maxWidth / $src.Width, $maxHeight / $src.Height)
    $drawWidth = [int]($src.Width * $scale)
    $drawHeight = [int]($src.Height * $scale)
    $drawX = [int]($x + (($maxWidth - $drawWidth) / 2))
    $drawY = [int]($y + (($maxHeight - $drawHeight) / 2))
    $shadow = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(40, 15, 23, 42))
    Draw-RoundedRectangle $graphics $shadow $null ($drawX + 14) ($drawY + 16) $drawWidth $drawHeight 18
    $white = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    Draw-RoundedRectangle $graphics $white $script:penFrame ($drawX - 10) ($drawY - 10) ($drawWidth + 20) ($drawHeight + 20) 18
    $graphics.DrawImage($src, $drawX, $drawY, $drawWidth, $drawHeight)
    $shadow.Dispose()
    $white.Dispose()
  } finally {
    $src.Dispose()
  }
}

function Save-Png24($bitmap, $path) {
  if (Test-Path $path) { Remove-Item $path }
  $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
}

function New-ScreenshotAsset($sourceName, $fileName, $title, $subtitle) {
  $bmp = New-StoreBitmap 1280 800
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  try {
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
    Fill-Background $g 1280 800
    Draw-TextBlockInRect $g $title $subtitle 86 96 590 80 110 $script:fontTitle $script:fontSub
    $g.FillRectangle($script:brushBlue, 86, 286, 92, 8)
    Draw-ImageCard $g (Join-Path $releaseDir $sourceName) 746 72 410 650
    Save-Png24 $bmp (Join-Path $screensDir $fileName)
  } finally {
    $g.Dispose()
    $bmp.Dispose()
  }
}

function New-SmallPromo {
  $bmp = New-StoreBitmap 440 280
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  try {
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
    Fill-Background $g 440 280
    Draw-TextBlockInRect $g "DSDN" "Chrome extension" 28 42 204 38 42 $script:fontPromoTitle $script:fontPromoSub
    $g.FillRectangle($script:brushBlue, 28, 128, 70, 6)
    Draw-ImageCard $g (Join-Path $releaseDir "Snipaste_2026-05-17_17-10-49.png") 252 30 132 194
    $taglineRect = New-Object System.Drawing.RectangleF(28, 194, 190, 50)
    $g.DrawString("View tasks. Add links.", $script:fontSmallLabel, $script:brushMuted, $taglineRect)
    Save-Png24 $bmp (Join-Path $promoDir "small-promo-440x280.png")
  } finally {
    $g.Dispose()
    $bmp.Dispose()
  }
}

function New-MarqueePromo {
  $bmp = New-StoreBitmap 1400 560
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  try {
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
    Fill-Background $g 1400 560
    Draw-TextBlockInRect $g "Download Station" "View current downloads and add URL or magnet tasks directly from Chrome." 92 126 780 88 86 $script:fontHeroTitle $script:fontHeroSub
    $g.FillRectangle($script:brushBlue, 92, 306, 128, 10)
    $g.DrawString("No third-party server. Your DSM connection stays local to Chrome.", $script:fontLabel, $script:brushMuted, 92, 342)
    Draw-ImageCard $g (Join-Path $releaseDir "Snipaste_2026-05-17_17-09-57.png") 930 50 300 460
    Draw-ImageCard $g (Join-Path $releaseDir "Snipaste_2026-05-17_17-10-49.png") 1138 142 220 260
    Save-Png24 $bmp (Join-Path $promoDir "marquee-promo-1400x560.png")
  } finally {
    $g.Dispose()
    $bmp.Dispose()
  }
}

New-ScreenshotAsset "Snipaste_2026-05-17_17-09-57.png" "screenshot-task-list-1280x800.png" "Monitor Tasks" "Sort, filter, and check current Synology downloads from a compact Chrome popup."
New-ScreenshotAsset "Snipaste_2026-05-17_17-10-36.png" "screenshot-task-detail-1280x800.png" "Inspect Task Details" "Open a task to review status, destination, source URI, and transfer metadata."
New-ScreenshotAsset "Snipaste_2026-05-17_17-10-49.png" "screenshot-add-download-1280x800.png" "Add Links" "Create URL or magnet tasks and choose a Download Station destination."
New-SmallPromo
New-MarqueePromo

Get-ChildItem -Recurse $outDir | Where-Object { -not $_.PSIsContainer } | Select-Object FullName, Length
