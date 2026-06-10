Add-Type -AssemblyName System.Drawing

$src = 'C:\Users\mattb\.cursor\projects\c-Users-mattb-Downloads-Pulpit-moja-strona\assets\c__Users_mattb_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_image-209c7d9a-213c-4699-bfc7-2c640f2328f8.png'
$dst = 'C:\Users\mattb\Downloads\Pulpit\moja strona\moja strona\images\games\teen-titans.png'

$bitmap = [System.Drawing.Bitmap]::FromFile($src)
$g = [System.Drawing.Graphics]::FromImage($bitmap)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::None
$black = [System.Drawing.Brushes]::Black

$w = $bitmap.Width
$h = $bitmap.Height

function DrawBar($xRatio, $yRatio, $wRatio, $hRatio) {
    $x = [int]($w * $xRatio)
    $y = [int]($h * $yRatio)
    $bw = [int]($w * $wRatio)
    $bh = [int]($h * $hRatio)
    $script:g.FillRectangle($black, $x, $y, $bw, $bh)
}

# Remove "18 TITANS" title band
DrawBar 0.18 0.0 0.64 0.14

# Remove "Download" button area
DrawBar 0.28 0.84 0.44 0.12

# Censor bars on exposed chests (crime-scene style horizontal bars)
# Center kissing pair - Starfire
DrawBar 0.36 0.52 0.12 0.055
DrawBar 0.36 0.595 0.12 0.055
# Center kissing pair - Raven
DrawBar 0.52 0.52 0.12 0.055
DrawBar 0.52 0.595 0.12 0.055

# Left foreground Starfire
DrawBar 0.04 0.62 0.14 0.05
DrawBar 0.04 0.695 0.14 0.05

# Left background Raven in water
DrawBar 0.17 0.48 0.11 0.045
DrawBar 0.17 0.545 0.11 0.045

# Bottom-right topless character
DrawBar 0.78 0.72 0.12 0.045
DrawBar 0.78 0.785 0.12 0.045

# Upper-right background pair
DrawBar 0.72 0.34 0.1 0.04
DrawBar 0.72 0.395 0.1 0.04

# Top-left blonde character behind Robin
DrawBar 0.08 0.28 0.11 0.04
DrawBar 0.08 0.335 0.11 0.04

# Middle-right masked character
DrawBar 0.83 0.58 0.1 0.04
DrawBar 0.83 0.635 0.1 0.04

$dir = Split-Path $dst -Parent
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }

$bitmap.Save($dst, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$bitmap.Dispose()

Write-Output "Saved $dst (${w}x${h})"
