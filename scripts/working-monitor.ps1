# Simple File Monitor for Cline Detection
# Monitors files and detects automated vs human changes

param(
    [string]$RepositoryPath = ".",
    [switch]$AutoCommit,
    [switch]$Verbose
)

# Configuration
$AUTOMATED_THRESHOLD = 2.0    # Seconds - less than this is likely automated
$HUMAN_THRESHOLD = 5.0        # Seconds - more than this is likely human
$BATCH_TIMEOUT = 8            # Seconds to wait before processing changes
$MAX_AUTO_FILES = 15          # Maximum files for auto-commit

# Colors
$Colors = @{
    Info = "Cyan"
    Success = "Green"
    Warning = "Yellow"
    Error = "Red"
    Human = "Blue"
    Automated = "Magenta"
}

function Write-ColoredOutput {
    param([string]$Message, [string]$Type = "Info")
    Write-Host $Message -ForegroundColor $Colors[$Type]
}

function Get-IgnorePatterns {
    $patterns = @()
    $gitignorePath = Join-Path $RepositoryPath ".gitignore"
    
    if (Test-Path $gitignorePath) {
        $patterns = Get-Content $gitignorePath | Where-Object { 
            $_ -and -not $_.StartsWith("#") -and $_.Trim() -ne ""
        }
    }
    
    $patterns += @(".git/*", "node_modules/*", "*.log", ".env*", "dist/*", "build/*", "*.tmp", "*.temp", ".vscode/*")
    return $patterns
}

function Test-ShouldIgnore {
    param([string]$FilePath, [string[]]$Patterns)
    
    try {
        $repoFullPath = (Resolve-Path $RepositoryPath).Path
        $relativePath = $FilePath -replace [regex]::Escape($repoFullPath + "\"), ""
        $relativePath = $relativePath -replace "\\", "/"
        
        foreach ($pattern in $Patterns) {
            $pattern = $pattern -replace "\\", "/"
            if ($pattern.EndsWith("/*")) {
                $folderPattern = $pattern.Substring(0, $pattern.Length - 2)
                if ($relativePath.StartsWith($folderPattern + "/")) { return $true }
            }
            elseif ($relativePath -like $pattern) { return $true }
        }
        return $false
    } catch {
        # If path resolution fails, be safe and ignore the file
        Write-ColoredOutput "WARNING: Path resolution failed for $FilePath" "Warning"
        return $true
    }
}

function Analyze-Changes {
    param([array]$Changes)
    
    if ($Changes.Count -eq 0) { return @{ Type = "unknown"; Confidence = 0 } }
    if ($Changes.Count -eq 1) { return @{ Type = "human"; Confidence = 0.6 } }
    
    # Calculate timing metrics
    $intervals = @()
    for ($i = 1; $i -lt $Changes.Count; $i++) {
        $interval = ($Changes[$i].Time - $Changes[$i-1].Time).TotalSeconds
        $intervals += $interval
    }
    
    $avgInterval = ($intervals | Measure-Object -Average).Average
    $minInterval = ($intervals | Measure-Object -Minimum).Minimum
    $totalDuration = ($Changes[-1].Time - $Changes[0].Time).TotalSeconds
    
    # Pattern analysis
    $rapidChanges = ($intervals | Where-Object { $_ -lt $AUTOMATED_THRESHOLD }).Count
    $humanChanges = ($intervals | Where-Object { $_ -gt $HUMAN_THRESHOLD }).Count
    
    # Classification logic
    $confidence = 0.5
    $type = "unknown"
    
    # Very rapid changes = likely automated (Cline)
    if ($avgInterval -lt $AUTOMATED_THRESHOLD -and $rapidChanges -gt ($Changes.Count * 0.7)) {
        $type = "automated"
        $confidence = 0.8 + (($AUTOMATED_THRESHOLD - $avgInterval) / $AUTOMATED_THRESHOLD) * 0.2
    }
    # Slower, more thoughtful changes = likely human
    elseif ($avgInterval -gt $HUMAN_THRESHOLD -or $humanChanges -gt ($Changes.Count * 0.5)) {
        $type = "human"
        $confidence = 0.7 + ($avgInterval / 30.0) * 0.3
    }
    # Many files changed quickly = likely automated
    elseif ($Changes.Count -gt 5 -and $avgInterval -lt 3.0) {
        $type = "automated"
        $confidence = 0.75
    }
    # Default to human with low confidence
    else {
        $type = "human"
        $confidence = 0.5
    }
    
    # Cap confidence at 100%
    $confidence = [Math]::Min($confidence, 1.0)
    
    return @{
        Type = $type
        Confidence = $confidence
        AvgInterval = $avgInterval
        FileCount = $Changes.Count
        TotalDuration = $totalDuration
        RapidChanges = $rapidChanges
    }
}

function Commit-Changes {
    param([array]$Changes, [hashtable]$Analysis)
    
    try {
        Write-ColoredOutput "ATTEMPTING: Staging and committing $($Changes.Count) files..." "Info"
        
        # Check git status first
        $gitStatus = git status --porcelain 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-ColoredOutput "ERROR: Git status failed: $gitStatus" "Error"
            return
        }
        
        # Stage files with better error handling
        $stagedFiles = @()
        foreach ($change in $Changes) {
            $relativePath = $change.Path -replace [regex]::Escape((Resolve-Path $RepositoryPath).Path + "\"), ""
            $relativePath = $relativePath -replace "\\", "/"
            
            Write-ColoredOutput "STAGING: $relativePath" "Info"
            $addResult = git add "$relativePath" 2>&1
            if ($LASTEXITCODE -eq 0) {
                $stagedFiles += $relativePath
            } else {
                Write-ColoredOutput "WARNING: Failed to stage $relativePath - $addResult" "Warning"
            }
        }
        
        if ($stagedFiles.Count -eq 0) {
            Write-ColoredOutput "ERROR: No files were successfully staged" "Error"
            return
        }
        
        # Create commit message
        $confidence = [Math]::Round($Analysis.Confidence * 100, 1)
        $commitMessage = "AUTO-COMMIT: $($stagedFiles.Count) files (${confidence}% confidence)

Detected as: $($Analysis.Type)
Duration: $([Math]::Round($Analysis.TotalDuration, 1))s
Avg interval: $([Math]::Round($Analysis.AvgInterval, 2))s

Files modified:
$($stagedFiles | ForEach-Object { "- $_" } | Out-String)
Generated by working-monitor.ps1"
        
        Write-ColoredOutput "COMMITTING: Creating commit..." "Info"
        $commitResult = git commit -m $commitMessage 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-ColoredOutput "SUCCESS: Auto-committed $($stagedFiles.Count) files" "Success"
            Write-ColoredOutput "COMMIT: $($commitResult -split "`n" | Select-Object -First 1)" "Success"
        } else {
            Write-ColoredOutput "ERROR: Commit failed: $commitResult" "Error"
        }
        
    } catch {
        Write-ColoredOutput "ERROR: Exception during commit: $_" "Error"
    }
}

function Process-ChangesBatch {
    param([array]$Changes)
    
    if ($Changes.Count -eq 0) { return }
    
    $analysis = Analyze-Changes -Changes $Changes
    
    $prefix = switch ($analysis.Type) {
        "automated" { "[AUTOMATED]" }
        "human" { "[HUMAN]" }
        default { "[UNKNOWN]" }
    }
    
    $color = switch ($analysis.Type) {
        "automated" { "Automated" }
        "human" { "Human" }
        default { "Info" }
    }
    
    $confidence = [Math]::Round($analysis.Confidence * 100, 1)
    $duration = [Math]::Round($analysis.TotalDuration, 1)
    $avgInterval = [Math]::Round($analysis.AvgInterval, 2)
    
    $message = "$prefix $($Changes.Count) files changed over ${duration}s (avg: ${avgInterval}s) - Confidence: ${confidence}%"
    Write-ColoredOutput $message $color
    
    if ($Verbose) {
        Write-ColoredOutput "Files changed:" "Info"
        foreach ($change in $Changes) {
            $relPath = $change.Path -replace [regex]::Escape($RepositoryPath + "\"), ""
            Write-ColoredOutput "  $relPath" "Info"
        }
    }
    
    # Auto-commit if it's detected as automated with high confidence
    if ($AutoCommit -and $analysis.Type -eq "automated" -and $analysis.Confidence -gt 0.75 -and $Changes.Count -le $MAX_AUTO_FILES) {
        Commit-Changes -Changes $Changes -Analysis $analysis
    }
}

# Main monitoring logic
$script:isRunning = $true
$changeBuffer = @()
$lastChangeTime = Get-Date

# Resolve repository path to absolute path
try {
    $RepositoryPath = (Resolve-Path $RepositoryPath).Path
} catch {
    Write-ColoredOutput "ERROR: Invalid repository path: $RepositoryPath" "Error"
    exit 1
}

$ignorePatterns = Get-IgnorePatterns

# Validate git repository
try {
    git status >$null 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-ColoredOutput "ERROR: Not in a git repository!" "Error"
        exit 1
    }
} catch {
    Write-ColoredOutput "ERROR: Git not available or not in a repository!" "Error"
    exit 1
}

Write-ColoredOutput "STARTING: Simple File Monitor" "Success"
Write-ColoredOutput "REPOSITORY: $RepositoryPath" "Info"
Write-ColoredOutput "AUTO-COMMIT: $AutoCommit" "Info"
Write-ColoredOutput "VERBOSE: $Verbose" "Info"
Write-ColoredOutput ""
Write-ColoredOutput "READY: Monitoring started. Press Ctrl+C to stop." "Success"
Write-ColoredOutput ""

# Setup file watcher
$watcher = New-Object System.IO.FileSystemWatcher
$watcher.Path = $RepositoryPath
$watcher.IncludeSubdirectories = $true
$watcher.EnableRaisingEvents = $true

$action = {
    $changeType = $Event.SourceEventArgs.ChangeType
    $filePath = $Event.SourceEventArgs.FullPath
    $fileName = $Event.SourceEventArgs.Name
    $timeStamp = Get-Date
    
    # Skip ignored files
    if (Test-ShouldIgnore -FilePath $filePath -Patterns $using:ignorePatterns) { 
        if ($using:Verbose) {
            Write-Host "IGNORED: $fileName (matches ignore pattern)" -ForegroundColor DarkGray
        }
        return 
    }
    if ($fileName -match '\.(tmp|temp|swp|~)$' -or $fileName.StartsWith('.#')) { 
        if ($using:Verbose) {
            Write-Host "IGNORED: $fileName (temporary file)" -ForegroundColor DarkGray
        }
        return 
    }
    
    $change = @{
        Path = $filePath
        Type = $changeType
        Time = $timeStamp
    }
    
    $script:changeBuffer += $change
    $script:lastChangeTime = $timeStamp
    
    if ($using:Verbose) {
        try {
            $repoPath = (Resolve-Path $using:RepositoryPath).Path
            $relPath = $filePath -replace [regex]::Escape($repoPath + "\"), ""
            Write-Host "DETECTED: $changeType - $relPath" -ForegroundColor Cyan
        } catch {
            Write-Host "DETECTED: $changeType - $fileName" -ForegroundColor Cyan
        }
    }
}

# Register events
Register-ObjectEvent -InputObject $watcher -EventName "Changed" -Action $action
Register-ObjectEvent -InputObject $watcher -EventName "Created" -Action $action
Register-ObjectEvent -InputObject $watcher -EventName "Deleted" -Action $action

# Handle Ctrl+C
Register-ObjectEvent -InputObject ([System.Console]) -EventName CancelKeyPress -Action {
    $script:isRunning = $false
    Write-ColoredOutput "STOPPING: Monitor shutting down..." "Warning"
}

# Main loop
try {
    while ($script:isRunning) {
        Start-Sleep -Milliseconds 500
        
        # Process batch if timeout reached
        $timeSinceLastChange = (Get-Date) - $lastChangeTime
        if ($changeBuffer.Count -gt 0 -and $timeSinceLastChange.TotalSeconds -gt $BATCH_TIMEOUT) {
            Process-ChangesBatch -Changes $changeBuffer
            $changeBuffer = @()
        }
    }
}
finally {
    # Cleanup
    $watcher.EnableRaisingEvents = $false
    $watcher.Dispose()
    Get-EventSubscriber | Unregister-Event
    Write-ColoredOutput "STOPPED: File monitoring stopped." "Info"
}
