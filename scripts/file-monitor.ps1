# File Monitor Script for Detecting Human vs Automated Changes
# This script monitors file changes and attempts to classify them as human or automated

param(
    [string]$RepositoryPath = ".",
    [int]$ThresholdSeconds = 2,
    [switch]$AutoCommit,
    [switch]$Verbose
)

# Configuration
$HUMAN_CHANGE_THRESHOLD = $ThresholdSeconds  # Seconds between changes to consider "human"
$AUTOMATED_CHANGE_THRESHOLD = 0.5  # Seconds between changes to consider "automated"
$BATCH_TIMEOUT = 10  # Seconds to wait before processing a batch of changes
$MAX_FILES_PER_COMMIT = 20  # Maximum files in a single automated commit

# Global variables
$script:fileChanges = @{}
$script:lastChangeTime = Get-Date
$script:changeBuffer = @()
$script:isMonitoring = $true

# Colors for output
$colors = @{
    Info = "Cyan"
    Success = "Green"
    Warning = "Yellow"
    Error = "Red"
    Human = "Blue"
    Automated = "Magenta"
}

function Write-ColoredOutput {
    param([string]$Message, [string]$Type = "Info")
    Write-Host $Message -ForegroundColor $colors[$Type]
}

function Get-GitIgnorePatterns {
    param([string]$RepoPath)
    
    $patterns = @()
    $gitignorePath = Join-Path $RepoPath ".gitignore"
    
    if (Test-Path $gitignorePath) {
        $patterns = Get-Content $gitignorePath | Where-Object { 
            $_ -and -not $_.StartsWith("#") -and $_.Trim() -ne ""
        }
    }
    
    # Add common patterns that shouldn't be monitored
    $patterns += @(
        ".git/*",
        "node_modules/*",
        "*.log",
        ".env",
        ".env.local",
        "dist/*",
        "build/*",
        "*.tmp",
        "*.temp"
    )
    
    return $patterns
}

function Test-ShouldIgnoreFile {
    param([string]$FilePath, [string[]]$IgnorePatterns)
    
    $relativePath = $FilePath -replace [regex]::Escape((Get-Location).Path + "\"), ""
    $relativePath = $relativePath -replace "\\", "/"
    
    foreach ($pattern in $IgnorePatterns) {
        $pattern = $pattern -replace "\\", "/"
        if ($pattern.EndsWith("/*")) {
            $folderPattern = $pattern.Substring(0, $pattern.Length - 2)
            if ($relativePath.StartsWith($folderPattern + "/")) {
                return $true
            }
        }
        elseif ($relativePath -like $pattern) {
            return $true
        }
    }
    
    return $false
}

function Analyze-ChangePattern {
    param([array]$Changes)
    
    if ($Changes.Count -eq 0) { return "unknown" }
    if ($Changes.Count -eq 1) { return "human" }
    
    # Calculate time differences between changes
    $timeDiffs = @()
    for ($i = 1; $i -lt $Changes.Count; $i++) {
        $diff = ($Changes[$i].Time - $Changes[$i-1].Time).TotalSeconds
        $timeDiffs += $diff
    }
    
    $avgTimeDiff = ($timeDiffs | Measure-Object -Average).Average
    $minTimeDiff = ($timeDiffs | Measure-Object -Minimum).Minimum
    $maxTimeDiff = ($timeDiffs | Measure-Object -Maximum).Maximum
    
    # Pattern analysis
    $rapidChanges = ($timeDiffs | Where-Object { $_ -lt $AUTOMATED_CHANGE_THRESHOLD }).Count
    $humanLikeChanges = ($timeDiffs | Where-Object { $_ -gt $HUMAN_CHANGE_THRESHOLD }).Count
    
    # Classification logic
    if ($rapidChanges -gt ($Changes.Count * 0.7)) {
        return "automated"
    }
    elseif ($humanLikeChanges -gt ($Changes.Count * 0.5)) {
        return "human"
    }
    elseif ($avgTimeDiff -lt 1.0) {
        return "automated"
    }
    elseif ($Changes.Count -gt $MAX_FILES_PER_COMMIT -and $avgTimeDiff -lt 3.0) {
        return "automated"
    }
    else {
        return "mixed"
    }
}

function Process-ChangeBatch {
    param([array]$Changes)
    
    if ($Changes.Count -eq 0) { return }
    
    $pattern = Analyze-ChangePattern -Changes $Changes
    $fileCount = $Changes.Count
    $timeSpan = if ($Changes.Count -gt 1) {
        ($Changes[-1].Time - $Changes[0].Time).TotalSeconds
    } else { 0 }
    
    $message = "Detected $fileCount file changes over $([math]::Round($timeSpan, 2)) seconds - Pattern: $pattern"
    
    switch ($pattern) {
        "automated" { 
            Write-ColoredOutput $message "Automated"
            if ($AutoCommit) {
                Commit-AutomatedChanges -Changes $Changes
            }
        }
        "human" { 
            Write-ColoredOutput $message "Human"
            # Don't auto-commit human changes
        }
        "mixed" { 
            Write-ColoredOutput $message "Warning"
            Write-ColoredOutput "Mixed pattern detected - manual review recommended" "Warning"
        }
        default { 
            Write-ColoredOutput $message "Info"
        }
    }
    
    if ($Verbose) {
        Write-ColoredOutput "Files changed:" "Info"
        foreach ($change in $Changes) {
            $relPath = $change.Path -replace [regex]::Escape((Get-Location).Path + "\"), ""
            Write-ColoredOutput "  $relPath" "Info"
        }
    }
}

function Commit-AutomatedChanges {
    param([array]$Changes)
    
    try {
        # Check if we're in a git repository
        $gitStatus = git status --porcelain 2>$null
        if ($LASTEXITCODE -ne 0) {
            Write-ColoredOutput "Not in a git repository" "Warning"
            return
        }
        
        # Stage all changed files
        $changedFiles = $Changes | ForEach-Object { $_.Path }
        foreach ($file in $changedFiles) {
            $relativePath = $file -replace [regex]::Escape((Get-Location).Path + "\"), ""
            git add $relativePath
        }
        
        # Create commit message
        $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        $commitMessage = "Automated commit: $($Changes.Count) files changed at $timestamp

Files modified:
$($Changes | ForEach-Object { "- $($_.Path -replace [regex]::Escape((Get-Location).Path + '\'), '')" } | Out-String)

Generated by file-monitor.ps1 - detected automated changes"
        
        # Commit changes
        git commit -m $commitMessage
        
        if ($LASTEXITCODE -eq 0) {
            Write-ColoredOutput "✅ Automated commit created successfully" "Success"
        } else {
            Write-ColoredOutput "❌ Failed to create commit" "Error"
        }
        
    } catch {
        Write-ColoredOutput "Error during automated commit: $_" "Error"
    }
}

function Start-FileMonitoring {
    param([string]$Path)
    
    $ignorePatterns = Get-GitIgnorePatterns -RepoPath $Path
    
    Write-ColoredOutput "🔍 Starting file monitoring in: $Path" "Info"
    Write-ColoredOutput "📊 Change thresholds - Human: ${HUMAN_CHANGE_THRESHOLD}s, Automated: ${AUTOMATED_CHANGE_THRESHOLD}s" "Info"
    Write-ColoredOutput "⚙️  Auto-commit: $AutoCommit" "Info"
    Write-ColoredOutput "" "Info"
    
    # Create file system watcher
    $watcher = New-Object System.IO.FileSystemWatcher
    $watcher.Path = $Path
    $watcher.IncludeSubdirectories = $true
    $watcher.EnableRaisingEvents = $true
    
    # Define the event handler
    $action = {
        $changeType = $Event.SourceEventArgs.ChangeType
        $filePath = $Event.SourceEventArgs.FullPath
        $fileName = $Event.SourceEventArgs.Name
        $timeStamp = Get-Date
        
        # Skip if file should be ignored
        if (Test-ShouldIgnoreFile -FilePath $filePath -IgnorePatterns $using:ignorePatterns) {
            return
        }
        
        # Skip temporary files and directories
        if ($fileName -match '\.(tmp|temp|swp|~)$' -or $fileName.StartsWith('.#')) {
            return
        }
        
        # Add to change buffer
        $change = @{
            Path = $filePath
            Type = $changeType
            Time = $timeStamp
        }
        
        $script:changeBuffer += $change
        $script:lastChangeTime = $timeStamp
        
        if ($using:Verbose) {
            $relPath = $filePath -replace [regex]::Escape($using:Path + "\"), ""
            Write-ColoredOutput "📝 $changeType`: $relPath" "Info"
        }
    }
    
    # Register event handlers
    Register-ObjectEvent -InputObject $watcher -EventName "Changed" -Action $action
    Register-ObjectEvent -InputObject $watcher -EventName "Created" -Action $action
    Register-ObjectEvent -InputObject $watcher -EventName "Deleted" -Action $action
    Register-ObjectEvent -InputObject $watcher -EventName "Renamed" -Action $action
    
    Write-ColoredOutput "✅ File monitoring started. Press Ctrl+C to stop." "Success"
    Write-ColoredOutput "🎯 Watching for patterns to distinguish human vs automated changes..." "Info"
    Write-ColoredOutput "" "Info"
    
    # Main monitoring loop
    try {
        while ($script:isMonitoring) {
            Start-Sleep -Milliseconds 500
            
            # Check if we should process the current batch
            $timeSinceLastChange = (Get-Date) - $script:lastChangeTime
            if ($script:changeBuffer.Count -gt 0 -and $timeSinceLastChange.TotalSeconds -gt $BATCH_TIMEOUT) {
                Process-ChangeBatch -Changes $script:changeBuffer
                $script:changeBuffer = @()
            }
        }
    }
    finally {
        # Clean up
        $watcher.EnableRaisingEvents = $false
        $watcher.Dispose()
        Get-EventSubscriber | Unregister-Event
        Write-ColoredOutput "🛑 File monitoring stopped." "Info"
    }
}

# Handle Ctrl+C gracefully
$null = Register-ObjectEvent -InputObject ([System.Console]) -EventName CancelKeyPress -Action {
    $script:isMonitoring = $false
    Write-ColoredOutput "`n🛑 Stopping file monitor..." "Warning"
}

# Validate repository path
$repoPath = Resolve-Path $RepositoryPath -ErrorAction SilentlyContinue
if (-not $repoPath) {
    Write-ColoredOutput "❌ Invalid repository path: $RepositoryPath" "Error"
    exit 1
}

# Change to repository directory
Set-Location $repoPath

# Start monitoring
Start-FileMonitoring -Path $repoPath
