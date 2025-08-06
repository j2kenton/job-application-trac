# Debug File Monitor - Minimal Version
param([switch]$AutoCommit)

$repoPath = Get-Location
Write-Host "DEBUG: Starting minimal file monitor in: $repoPath" -ForegroundColor Green
Write-Host "DEBUG: Auto-commit enabled: $AutoCommit" -ForegroundColor Cyan

# Create watcher
$watcher = New-Object System.IO.FileSystemWatcher
$watcher.Path = $repoPath
$watcher.IncludeSubdirectories = $true
$watcher.EnableRaisingEvents = $true

Write-Host "DEBUG: Watcher created, watching: $($watcher.Path)" -ForegroundColor Yellow
Write-Host "DEBUG: Subdirectories: $($watcher.IncludeSubdirectories)" -ForegroundColor Yellow
Write-Host "DEBUG: Events enabled: $($watcher.EnableRaisingEvents)" -ForegroundColor Yellow

# Simple action that just logs everything
$action = {
    $path = $Event.SourceEventArgs.FullPath
    $changeType = $Event.SourceEventArgs.ChangeType
    $fileName = Split-Path $path -Leaf
    $timestamp = Get-Date -Format "HH:mm:ss"
    
    Write-Host "[$timestamp] $changeType - $fileName" -ForegroundColor Magenta
    
    if ($using:AutoCommit -and $fileName -notmatch '\.(tmp|temp|swp)$' -and $fileName -notlike '.*') {
        try {
            $relativePath = $path -replace [regex]::Escape($using:repoPath.Path + "\"), ""
            git add $relativePath
            $result = git commit -m "Debug auto-commit: $fileName"
            Write-Host "COMMITTED: $fileName - $result" -ForegroundColor Green
        } catch {
            Write-Host "COMMIT FAILED: $fileName - $_" -ForegroundColor Red
        }
    }
}

# Register events
Write-Host "DEBUG: Registering event handlers..." -ForegroundColor Yellow
Register-ObjectEvent -InputObject $watcher -EventName "Changed" -Action $action
Register-ObjectEvent -InputObject $watcher -EventName "Created" -Action $action
Register-ObjectEvent -InputObject $watcher -EventName "Deleted" -Action $action

Write-Host ""
Write-Host "READY: Debug monitor active. Make file changes to test..." -ForegroundColor Green
Write-Host "Press Ctrl+C to stop" -ForegroundColor Cyan
Write-Host ""

try {
    while ($true) {
        Start-Sleep -Seconds 1
        # Show a heartbeat every 30 seconds
        if ((Get-Date).Second % 30 -eq 0) {
            Write-Host "DEBUG: Monitor heartbeat - $(Get-Date -Format 'HH:mm:ss')" -ForegroundColor DarkGray
        }
    }
}
finally {
    Write-Host "DEBUG: Cleaning up..." -ForegroundColor Yellow
    $watcher.Dispose()
    Get-EventSubscriber | Unregister-Event
    Write-Host "DEBUG: Monitor stopped" -ForegroundColor Red
}
