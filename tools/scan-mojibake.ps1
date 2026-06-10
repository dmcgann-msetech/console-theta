param(
  [string[]]$Roots = @("index.html","README.md","CHANGELOG.md","js")
)

$patterns = @("â","Â","Ã","ðŸ")
$files = @()

foreach ($root in $Roots) {
  if (Test-Path $root -PathType Leaf) {
    $files += Get-Item $root
  } elseif (Test-Path $root -PathType Container) {
    $files += Get-ChildItem $root -Recurse -File -Include *.js,*.html,*.md,*.css,*.json
  }
}

$hits = foreach ($file in $files) {
  Select-String -Path $file.FullName -Pattern $patterns -SimpleMatch |
    Select-Object Path, LineNumber, Line
}

$hits | Format-Table -AutoSize
Write-Host ""
Write-Host ("Mojibake hits: " + @($hits).Count)
