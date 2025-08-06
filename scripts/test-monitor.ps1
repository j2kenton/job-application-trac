# Test File Monitor - Simple Version
param(
    [switch]$AutoCommit
)

Write-Host "TEST MONITOR: Starting simple file watcher test..." -ForegroundColor Green
Write-Host "AUTO-COMMIT: $AutoCommit" -ForegroundColor Cyan
Write-Host ""

# Create a simple watcher for the current directory
$watcher = New-Object System.IO.FileSystemWatcher
$watcher.Path = Get-Location
$watcher.IncludeSubdirectories = $true
$watcher.EnableRaisingEvents = $true

# Simple event handler
$action = {
    $path = $Event.SourceEventArgs.FullPath
    $changeType = $Event.SourceEventArgs.ChangeType
    $fileName = Split-Path $path -Leaf
    
    # Skip temp and git files
    if ($fileName -match '\.(tmp|temp|swp)$' -or $path -match '\\\.git\\') {
        return
    }
    
    Write-Host "DETECTED: $changeType - $fileName" -ForegroundColor Yellow
    
    # If auto-commit is enabled, commit immediately
    if ($using:AutoCommit) {
        try {
            $relativePath = $path -replace [regex]::Escape((Get-Location).Path + "\"), ""
            git add $relativePath 2>$null
            git commit -m "Auto-commit: $fileName changed" 2>$null
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host "COMMITTED: $fileName" -ForegroundColor Green
            } else {
                Write-Host "FAILED TO COMMIT: $fileName" -ForegroundColor Red
            }
        } catch {
            Write-Host "ERROR: $_" -ForegroundColor Red
        }
    }
}

# Register all events
Register-ObjectEvent -InputObject $watcher -EventName "Changed" -Action $action
Register-ObjectEvent -InputObject $watcher -EventName "Created" -Action $action
Register-ObjectEvent -InputObject $watcher -EventName "Deleted" -Action $action

Write-Host "READY: Test monitor active. Make some file changes to test..." -ForegroundColor Green
Write-Host "Press Ctrl+C to stop" -ForegroundColor Cyan
Write-Host ""

try {
    # Keep running until Ctrl+C
    while ($true) {
        Start-Sleep -Seconds 1
    }
}
finally {
    # Cleanup
    $watcher.Dispose()
    Get-EventSubscriber | Unregister-Event
    Write-Host "STOPPED: Test monitor stopped" -ForegroundColor Yellow
}
