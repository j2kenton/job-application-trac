#!/usr/bin/env node

/**
 * Auto-commit script for Job Application Tracker
 * Automatically commits changes after task completion
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class AutoCommit {
  constructor() {
    this.projectRoot = process.cwd();
    this.logFile = path.join(this.projectRoot, 'automation.log');
  }

  log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${level}] ${message}`;
    console.log(logEntry);
    
    try {
      fs.appendFileSync(this.logFile, logEntry + '\n');
    } catch (error) {
      console.error('Failed to write to log file:', error.message);
    }
  }

  async checkGitStatus() {
    try {
      const status = execSync('git status --porcelain', { encoding: 'utf8' });
      return status.trim().length > 0;
    } catch (error) {
      this.log(`Git status check failed: ${error.message}`, 'ERROR');
      return false;
    }
  }

  async getRecentCommits(count = 3) {
    try {
      const commits = execSync(`git log --oneline -${count}`, { encoding: 'utf8' });
      return commits.trim().split('\n');
    } catch (error) {
      this.log(`Failed to get recent commits: ${error.message}`, 'ERROR');
      return [];
    }
  }

  generateCommitMessage() {
    const timestamp = new Date().toISOString().split('T')[0];
    const time = new Date().toTimeString().split(' ')[0];
    
    // Try to detect what type of changes were made
    try {
      const status = execSync('git status --porcelain', { encoding: 'utf8' });
      const lines = status.trim().split('\n').filter(line => line.length > 0);
      
      let hasNewFiles = false;
      let hasModifiedFiles = false;
      let hasDeletedFiles = false;
      let fileTypes = new Set();
      
      lines.forEach(line => {
        const statusCode = line.substring(0, 2);
        const filename = line.substring(3);
        
        if (statusCode.includes('A') || statusCode.includes('??')) hasNewFiles = true;
        if (statusCode.includes('M')) hasModifiedFiles = true;
        if (statusCode.includes('D')) hasDeletedFiles = true;
        
        const ext = path.extname(filename);
        if (ext) fileTypes.add(ext);
      });
      
      let type = 'chore';
      let description = 'automatic commit';
      
      if (hasNewFiles && hasModifiedFiles) {
        type = 'feat';
        description = 'add new features and update existing code';
      } else if (hasNewFiles) {
        type = 'feat';
        description = 'add new files and functionality';
      } else if (hasModifiedFiles) {
        type = 'fix';
        description = 'update and improve existing features';
      } else if (hasDeletedFiles) {
        type = 'refactor';
        description = 'remove and reorganize code';
      }
      
      // Add file type context
      if (fileTypes.size > 0) {
        const types = Array.from(fileTypes).join(', ');
        description += ` (${types})`;
      }
      
      return `${type}: ${description}\n\nAuto-commit on ${timestamp} at ${time}\nFiles changed: ${lines.length}`;
      
    } catch (error) {
      this.log(`Failed to analyze changes: ${error.message}`, 'WARN');
      return `chore: automatic commit on ${timestamp} at ${time}`;
    }
  }

  async performCommit() {
    try {
      this.log('Starting auto-commit process...');
      
      // Check if there are changes to commit
      const hasChanges = await this.checkGitStatus();
      if (!hasChanges) {
        this.log('No changes to commit');
        return false;
      }
      
      // Stage all changes
      this.log('Staging all changes...');
      execSync('git add .', { stdio: 'inherit' });
      
      // Generate commit message
      const commitMessage = this.generateCommitMessage();
      this.log(`Generated commit message: ${commitMessage.split('\n')[0]}`);
      
      // Commit changes
      this.log('Committing changes...');
      execSync(`git commit -m "${commitMessage}"`, { stdio: 'inherit' });
      
      this.log('Auto-commit completed successfully!', 'SUCCESS');
      return true;
      
    } catch (error) {
      this.log(`Auto-commit failed: ${error.message}`, 'ERROR');
      return false;
    }
  }

  async showStatus() {
    this.log('='.repeat(50));
    this.log('Job Application Tracker - Auto-commit Status');
    this.log('='.repeat(50));
    
    // Show current git status
    try {
      const hasChanges = await this.checkGitStatus();
      this.log(`Pending changes: ${hasChanges ? 'YES' : 'NO'}`);
      
      // Show recent commits
      const recentCommits = await this.getRecentCommits();
      this.log('Recent commits:');
      recentCommits.forEach((commit, i) => {
        this.log(`  ${i + 1}. ${commit}`);
      });
      
    } catch (error) {
      this.log(`Status check failed: ${error.message}`, 'ERROR');
    }
    
    this.log('='.repeat(50));
  }
}

// CLI usage
if (require.main === module) {
  const autoCommit = new AutoCommit();
  const command = process.argv[2] || 'commit';
  
  switch (command) {
    case 'commit':
      autoCommit.performCommit();
      break;
    case 'status':
      autoCommit.showStatus();
      break;
    case 'help':
      console.log(`
Usage: node scripts/auto-commit.js [command]

Commands:
  commit  - Automatically commit all changes (default)
  status  - Show current git status and recent commits
  help    - Show this help message

Examples:
  node scripts/auto-commit.js
  node scripts/auto-commit.js commit
  node scripts/auto-commit.js status
      `);
      break;
    default:
      console.log(`Unknown command: ${command}. Use 'help' for usage information.`);
  }
}

module.exports = AutoCommit;
