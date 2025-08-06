# Advanced File Monitor with Cline Detection
# This script uses sophisticated pattern analysis to detect Cline vs human changes

param(
    [string]$RepositoryPath = ".",
    [switch]$AutoCommit,
    [switch]$Verbose,
    [int]$LearningPeriod = 300, # 5 minutes to learn patterns
    [double]$ConfidenceThreshold = 0.8
)

# Enhanced configuration
$PATTERNS = @{
    Human = @{
        TypicalChangeInterval = @(5, 30)      # 5-30 seconds between changes
        FilesPerBatch = @(1, 5)               # 1-5 files per batch
        EditDuration = @(10, 300)             # 10 seconds to 5 minutes editing
        PausesBetweenBatches = @(30, 600)     # 30 seconds to 10 minutes
    }
    Cline = @{
        TypicalChangeInterval = @(0.1, 2)     # 0.1-2 seconds between changes
        FilesPerBatch = @(3, 50)              # 3-50 files per batch
        EditDuration = @(1, 10)               # 1-10 seconds editing
        BurstPattern = $true                  # Changes in rapid bursts
        ConsistentTiming = $true              # Very consistent timing
    }
    IDE = @{
        TypicalChangeInterval = @(0.5, 5)     # 0.5-5 seconds between changes
        FilesPerBatch = @(1, 10)              # 1-10 files per batch
        AutoSavePattern = $true               # Regular auto-save intervals
    }
}

class ChangePattern {
    [DateTime]$StartTime
    [DateTime]$EndTime
    [System.Collections.ArrayList]$Changes
    [string]$Classification
    [double]$Confidence
    [hashtable]$Metrics
    
    ChangePattern() {
        $this.Changes = New-Object System.Collections.ArrayList
        $this.Metrics = @{}
    }
    
    [void]AddChange([hashtable]$Change) {
        $this.Changes.Add($Change)
        if ($this.Changes.Count -eq 1) {
            $this.StartTime = $Change.Time
        }
        $this.EndTime = $Change.Time
    }
    
    [void]CalculateMetrics() {
        if ($this.Changes.Count -eq 0) { return }
        
        # Time-based metrics
        $intervals = @()
        for ($i = 1; $i -lt $this.Changes.Count; $i++) {
            $interval = ($this.Changes[$i].Time - $this.Changes[$i-1].Time).TotalSeconds
            $intervals += $interval
        }
        
        if ($intervals.Count -gt 0) {
            $this.Metrics['AvgInterval'] = ($intervals | Measure-Object -Average).Average
            $this.Metrics['MinInterval'] = ($intervals | Measure-Object -Minimum).Minimum
            $this.Metrics['MaxInterval'] = ($intervals | Measure-Object -Maximum).Maximum
            $this.Metrics['IntervalStdDev'] = [Math]::Sqrt((($intervals | ForEach-Object { [Math]::Pow($_ - $this.Metrics['AvgInterval'], 2) }) | Measure-Object -Sum).Sum / $intervals.Count)
        }
        
        # File-based metrics
        $this.Metrics['FileCount'] = $this.Changes.Count
        $this.Metrics['UniqueFiles'] = ($this.Changes | Select-Object -ExpandProperty Path | Sort-Object -Unique).Count
        $this.Metrics['TotalDuration'] = ($this.EndTime - $this.StartTime).TotalSeconds
        
        # Pattern-specific metrics
        $this.Metrics['ConsistencyScore'] = if ($this.Metrics['IntervalStdDev'] -gt 0) { 
            1 / (1 + $this.Metrics['IntervalStdDev']) 
        } else { 1 }
        
        # File type diversity
        $extensions = $this.Changes | ForEach-Object { 
            [System.IO.Path]::GetExtension($_.Path) 
        } | Where-Object { $_ } | Sort-Object -Unique
        $this.Metrics['FileTypeDiversity'] = $extensions.Count
        
        # Burst detection
        $burstCount = 0
        $currentBurstSize = 0
        for ($i = 1; $i -lt $intervals.Count; $i++) {
            if ($intervals[$i] -lt 1.0) {
                $currentBurstSize++
            } else {
                if ($currentBurstSize -gt 2) { $burstCount++ }
                $currentBurstSize = 0
            }
        }
        $this.Metrics['BurstCount'] = $burstCount
    }
    
    [string]ClassifyPattern() {
        $this.CalculateMetrics()
        
        # Feature scoring
        $scores = @{
            Human = 0
            Cline = 0
            IDE = 0
        }
        
        # Interval analysis
        $avgInterval = $this.Metrics['AvgInterval']
        if ($avgInterval -ge 5 -and $avgInterval -le 30) {
            $scores.Human += 0.3
        } elseif ($avgInterval -le 2) {
            $scores.Cline += 0.4
            $scores.IDE += 0.2
        }
        
        # Consistency analysis (Cline tends to be very consistent)
        $consistency = $this.Metrics['ConsistencyScore']
        if ($consistency -gt 0.8) {
            $scores.Cline += 0.3
        } elseif ($consistency -lt 0.4) {
            $scores.Human += 0.2
        }
        
        # File count analysis
        $fileCount = $this.Metrics['FileCount']
        if ($fileCount -eq 1) {
            $scores.Human += 0.2
        } elseif ($fileCount -gt 10) {
            $scores.Cline += 0.3
        }
        
        # Burst pattern analysis
        $burstCount = $this.Metrics['BurstCount']
        if ($burstCount -gt 0) {
            $scores.Cline += 0.2
        }
        
        # Duration analysis
        $duration = $this.Metrics['TotalDuration']
        if ($duration -lt 10) {
            $scores.Cline += 0.2
        } elseif ($duration -gt 60) {
            $scores.Human += 0.2
        }
        
        # File type diversity (Cline often changes multiple file types)
        $diversity = $this.Metrics['FileTypeDiversity']
        if ($diversity -gt 3) {
            $scores.Cline += 0.1
        }
        
        # Determine classification
        $maxScore = ($scores.Values | Measure-Object -Maximum).Maximum
        $classification = $scores.Keys | Where-Object { $scores[$_] -eq $maxScore } | Select-Object -First 1
        $this.Confidence = $maxScore
        
        return $classification
    }
}

class FileMonitor {
    [string]$RepositoryPath
    [System.IO.FileSystemWatcher]$Watcher
    [System.Collections.ArrayList]$CurrentChanges
    [System.Collections.ArrayList]$CompletedPatterns
    [DateTime]$LastChangeTime
    [bool]$IsLearning
    [hashtable]$LearnedPatterns
    [string[]]$IgnorePatterns
    
    FileMonitor([string]$RepoPath) {
        $this.RepositoryPath = $RepoPath
        $this.CurrentChanges = New-Object System.Collections.ArrayList
        $this.CompletedPatterns = New-Object System.Collections.ArrayList
        $this.LastChangeTime = Get-Date
        $this.IsLearning = $true
        $this.LearnedPatterns = @{}
        $this.IgnorePatterns = $this.GetGitIgnorePatterns()
        
        $this.SetupWatcher()
    }
    
    [string[]]GetGitIgnorePatterns() {
        $patterns = @()
        $gitignorePath = Join-Path $this.RepositoryPath ".gitignore"
        
        if (Test-Path $gitignorePath) {
            $patterns = Get-Content $gitignorePath | Where-Object { 
                $_ -and -not $_.StartsWith("#") -and $_.Trim() -ne ""
            }
        }
        
        # Add common patterns
        $patterns += @(
            ".git/*", "node_modules/*", "*.log", ".env*", "dist/*", 
            "build/*", "*.tmp", "*.temp", ".vscode/*", "*.swp"
        )
        
        return $patterns
    }
    
    [bool]ShouldIgnoreFile([string]$FilePath) {
        $relativePath = $FilePath -replace [regex]::Escape($this.RepositoryPath + "\"), ""
        $relativePath = $relativePath -replace "\\", "/"
        
        foreach ($pattern in $this.IgnorePatterns) {
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
    
    [void]SetupWatcher() {
        $this.Watcher = New-Object System.IO.FileSystemWatcher
        $this.Watcher.Path = $this.RepositoryPath
        $this.Watcher.IncludeSubdirectories = $true
        $this.Watcher.EnableRaisingEvents = $true
        
        # Event handler
        $action = {
            $monitor = $Event.MessageData
            $changeType = $Event.SourceEventArgs.ChangeType
            $filePath = $Event.SourceEventArgs.FullPath
            $fileName = $Event.SourceEventArgs.Name
            $timeStamp = Get-Date
            
            # Skip ignored files
            if ($monitor.ShouldIgnoreFile($filePath)) { return }
            
            # Skip temp files
            if ($fileName -match '\.(tmp|temp|swp|~)$' -or $fileName.StartsWith('.#')) { return }
            
            $change = @{
                Path = $filePath
                Type = $changeType
                Time = $timeStamp
                FileName = $fileName
            }
            
            $monitor.CurrentChanges.Add($change)
            $monitor.LastChangeTime = $timeStamp
            
            if ($using:Verbose) {
                $relPath = $filePath -replace [regex]::Escape($monitor.RepositoryPath + "\"), ""
                Write-Host "📝 $changeType`: $relPath" -ForegroundColor Cyan
            }
        }
        
        Register-ObjectEvent -InputObject $this.Watcher -EventName "Changed" -Action $action -MessageData $this
        Register-ObjectEvent -InputObject $this.Watcher -EventName "Created" -Action $action -MessageData $this
        Register-ObjectEvent -InputObject $this.Watcher -EventName "Deleted" -Action $action -MessageData $this
        Register-ObjectEvent -InputObject $this.Watcher -EventName "Renamed" -Action $action -MessageData $this
    }
    
    [void]ProcessCurrentChanges() {
        if ($this.CurrentChanges.Count -eq 0) { return }
        
        $pattern = [ChangePattern]::new()
        foreach ($change in $this.CurrentChanges) {
            $pattern.AddChange($change)
        }
        
        $classification = $pattern.ClassifyPattern()
        $pattern.Classification = $classification
        
        $this.CompletedPatterns.Add($pattern)
        
        # Output results
        $this.ReportPattern($pattern)
        
        # Auto-commit if it's detected as Cline
        if ($AutoCommit -and $classification -eq "Cline" -and $pattern.Confidence -gt $ConfidenceThreshold) {
            $this.CommitClineChanges($pattern)
        }
        
        $this.CurrentChanges.Clear()
    }
    
    [void]ReportPattern([ChangePattern]$Pattern) {
        $fileCount = $Pattern.Changes.Count
        $duration = [Math]::Round($Pattern.Metrics['TotalDuration'], 2)
        $avgInterval = [Math]::Round($Pattern.Metrics['AvgInterval'], 2)
        $confidence = [Math]::Round($Pattern.Confidence * 100, 1)
        
        $emoji = switch ($Pattern.Classification) {
            "Human" { "👤" }
            "Cline" { "🤖" }
            "IDE" { "💻" }
            default { "❓" }
        }
        
        $color = switch ($Pattern.Classification) {
            "Human" { "Blue" }
            "Cline" { "Magenta" }
            "IDE" { "Yellow" }
            default { "Gray" }
        }
        
        $message = "$emoji [$($Pattern.Classification)] $fileCount files changed over ${duration}s (avg: ${avgInterval}s) - Confidence: ${confidence}%"
        Write-Host $message -ForegroundColor $color
        
        if ($Verbose -and $Pattern.Metrics.Count -gt 0) {
            Write-Host "  📊 Metrics:" -ForegroundColor Gray
            Write-Host "    • File diversity: $($Pattern.Metrics['FileTypeDiversity'])" -ForegroundColor Gray
            Write-Host "    • Consistency: $([Math]::Round($Pattern.Metrics['ConsistencyScore'], 2))" -ForegroundColor Gray
            Write-Host "    • Bursts: $($Pattern.Metrics['BurstCount'])" -ForegroundColor Gray
        }
    }
    
    [void]CommitClineChanges([ChangePattern]$Pattern) {
        try {
            # Check git status
            $gitStatus = git status --porcelain 2>$null
            if ($LASTEXITCODE -ne 0) {
                Write-Host "⚠️  Not in a git repository" -ForegroundColor Yellow
                return
            }
            
            # Stage files
            foreach ($change in $Pattern.Changes) {
                $relativePath = $change.Path -replace [regex]::Escape($this.RepositoryPath + "\"), ""
                git add $relativePath 2>$null
            }
            
            # Create commit message
            $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
            $duration = [Math]::Round($Pattern.Metrics['TotalDuration'], 1)
            $confidence = [Math]::Round($Pattern.Confidence * 100, 1)
            
            $commitMessage = "🤖 Cline: Auto-commit $($Pattern.Changes.Count) files (${confidence}% confidence)

Duration: ${duration}s
Average interval: $([Math]::Round($Pattern.Metrics['AvgInterval'], 2))s
Files modified:
$($Pattern.Changes | ForEach-Object { "- $($_.Path -replace [regex]::Escape($this.RepositoryPath + '\'), '')" } | Out-String)
Generated by file-monitor.ps1 - detected Cline activity"
            
            git commit -m $commitMessage 2>$null
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host "✅ Auto-committed Cline changes" -ForegroundColor Green
            } else {
                Write-Host "❌ Failed to commit changes" -ForegroundColor Red
            }
            
        } catch {
            Write-Host "Error during auto-commit: $_" -ForegroundColor Red
        }
    }
    
    [void]StartMonitoring() {
        Write-Host "🔍 Advanced File Monitor Started" -ForegroundColor Green
        Write-Host "📂 Repository: $($this.RepositoryPath)" -ForegroundColor Cyan
        Write-Host "🤖 Auto-commit Cline changes: $AutoCommit" -ForegroundColor Cyan
        Write-Host "🎯 Confidence threshold: $($ConfidenceThreshold * 100)%" -ForegroundColor Cyan
        Write-Host "📚 Learning period: $LearningPeriod seconds" -ForegroundColor Cyan
        Write-Host ""
        
        $startTime = Get-Date
        $script:isMonitoring = $true
        
        try {
            while ($script:isMonitoring) {
                Start-Sleep -Milliseconds 500
                
                # Check if learning period is over
                if ($this.IsLearning -and ((Get-Date) - $startTime).TotalSeconds -gt $LearningPeriod) {
                    $this.IsLearning = $false
                    Write-Host "🎓 Learning period completed. Now actively monitoring..." -ForegroundColor Green
                }
                
                # Process current batch if timeout reached
                $timeSinceLastChange = (Get-Date) - $this.LastChangeTime
                if ($this.CurrentChanges.Count -gt 0 -and $timeSinceLastChange.TotalSeconds -gt 5) {
                    $this.ProcessCurrentChanges()
                }
            }
        }
        finally {
            $this.Cleanup()
        }
    }
    
    [void]Cleanup() {
        if ($this.Watcher) {
            $this.Watcher.EnableRaisingEvents = $false
            $this.Watcher.Dispose()
        }
        Get-EventSubscriber | Unregister-Event
        Write-Host "🛑 File monitoring stopped." -ForegroundColor Yellow
        
        # Show summary
        if ($this.CompletedPatterns.Count -gt 0) {
            Write-Host ""
            Write-Host "📊 Session Summary:" -ForegroundColor Green
            $humanCount = ($this.CompletedPatterns | Where-Object { $_.Classification -eq "Human" }).Count
            $clineCount = ($this.CompletedPatterns | Where-Object { $_.Classification -eq "Cline" }).Count
            $ideCount = ($this.CompletedPatterns | Where-Object { $_.Classification -eq "IDE" }).Count
            
            Write-Host "  👤 Human patterns: $humanCount" -ForegroundColor Blue
            Write-Host "  🤖 Cline patterns: $clineCount" -ForegroundColor Magenta
            Write-Host "  💻 IDE patterns: $ideCount" -ForegroundColor Yellow
        }
    }
}

# Handle Ctrl+C gracefully
$script:isMonitoring = $true
$null = Register-ObjectEvent -InputObject ([System.Console]) -EventName CancelKeyPress -Action {
    $script:isMonitoring = $false
    Write-Host "`n🛑 Stopping file monitor..." -ForegroundColor Yellow
}

# Validate repository path
$repoPath = Resolve-Path $RepositoryPath -ErrorAction SilentlyContinue
if (-not $repoPath) {
    Write-Host "❌ Invalid repository path: $RepositoryPath" -ForegroundColor Red
    exit 1
}

# Change to repository directory
Set-Location $repoPath

# Create and start monitor
$monitor = [FileMonitor]::new($repoPath)
$monitor.StartMonitoring()
