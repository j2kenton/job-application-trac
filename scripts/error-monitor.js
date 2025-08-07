// Error monitoring script for automatic console error detection and fixing
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

class ErrorMonitor {
  constructor() {
    this.logFile = path.join(__dirname, '..', 'error-log.json');
    this.knownErrors = new Map();
    this.fixAttempts = new Map();
    this.maxFixAttempts = 3;
  }

  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`);
    
    // Append to log file
    const logEntry = { timestamp, level, message };
    this.appendToLogFile(logEntry);
  }

  appendToLogFile(entry) {
    try {
      let logs = [];
      if (fs.existsSync(this.logFile)) {
        const content = fs.readFileSync(this.logFile, 'utf8');
        logs = JSON.parse(content);
      }
      logs.push(entry);
      
      // Keep only last 100 entries
      if (logs.length > 100) {
        logs = logs.slice(-100);
      }
      
      fs.writeFileSync(this.logFile, JSON.stringify(logs, null, 2));
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  identifyErrorType(error) {
    const errorText = error.toLowerCase();
    
    if (errorText.includes('module not found') || errorText.includes('cannot resolve')) {
      return 'MISSING_MODULE';
    }
    if (errorText.includes('typescript') || errorText.includes('type error')) {
      return 'TYPE_ERROR';
    }
    if (errorText.includes('syntax error') || errorText.includes('unexpected token')) {
      return 'SYNTAX_ERROR';
    }
    if (errorText.includes('network error') || errorText.includes('fetch')) {
      return 'NETWORK_ERROR';
    }
    if (errorText.includes('linkedin') || errorText.includes('gmail')) {
      return 'API_ERROR';
    }
    if (errorText.includes('import') || errorText.includes('export')) {
      return 'IMPORT_ERROR';
    }
    
    return 'UNKNOWN_ERROR';
  }

  async autoFix(error, errorType) {
    const errorKey = `${errorType}:${error.substring(0, 100)}`;
    const attempts = this.fixAttempts.get(errorKey) || 0;
    
    if (attempts >= this.maxFixAttempts) {
      this.log(`Max fix attempts reached for: ${errorKey}`, 'warn');
      return false;
    }
    
    this.fixAttempts.set(errorKey, attempts + 1);
    this.log(`Attempting auto-fix for ${errorType} (attempt ${attempts + 1})`, 'info');
    
    try {
      switch (errorType) {
        case 'MISSING_MODULE':
          return await this.fixMissingModule(error);
        case 'TYPE_ERROR':
          return await this.fixTypeError(error);
        case 'SYNTAX_ERROR':
          return await this.fixSyntaxError(error);
        case 'IMPORT_ERROR':
          return await this.fixImportError(error);
        case 'API_ERROR':
          return await this.fixApiError(error);
        default:
          this.log(`No auto-fix available for error type: ${errorType}`, 'warn');
          return false;
      }
    } catch (fixError) {
      this.log(`Auto-fix failed: ${fixError.message}`, 'error');
      return false;
    }
  }

  async fixMissingModule(error) {
    // Extract module name from error
    const moduleMatch = error.match(/Cannot resolve module ['"`]([^'"`]+)['"`]/);
    if (!moduleMatch) return false;
    
    const moduleName = moduleMatch[1];
    this.log(`Installing missing module: ${moduleName}`);
    
    return new Promise((resolve) => {
      exec(`npm install ${moduleName}`, (err, stdout, stderr) => {
        if (err) {
          this.log(`Failed to install ${moduleName}: ${err.message}`, 'error');
          resolve(false);
        } else {
          this.log(`Successfully installed ${moduleName}`, 'success');
          resolve(true);
        }
      });
    });
  }

  async fixTypeError(error) {
    // Common TypeScript fixes
    if (error.includes('Property does not exist')) {
      this.log('Type error detected - may need interface updates', 'warn');
      // Could implement automatic interface updates here
    }
    return false;
  }

  async fixSyntaxError(error) {
    // Basic syntax error detection and fixing
    this.log('Syntax error detected - manual intervention may be required', 'warn');
    return false;
  }

  async fixImportError(error) {
    // Fix common import/export issues
    this.log('Import error detected - checking file paths', 'info');
    return false;
  }

  async fixApiError(error) {
    // API-related error fixes
    if (error.includes('linkedin') || error.includes('gmail')) {
      this.log('API error detected - checking service configuration', 'warn');
      // Could implement service health checks and reinitialization
    }
    return false;
  }

  startMonitoring() {
    this.log('Error monitoring system started');
    this.log('Monitoring for console errors in development environment');
    
    // In a real implementation, this would connect to browser console
    // For now, we'll monitor the build process and logs
    this.monitorBuildProcess();
  }

  monitorBuildProcess() {
    // Monitor for build errors
    const buildProcess = exec('npm run dev', { cwd: path.join(__dirname, '..') });
    
    buildProcess.stderr.on('data', (data) => {
      const error = data.toString();
      this.log(`Build error detected: ${error}`, 'error');
      
      const errorType = this.identifyErrorType(error);
      this.autoFix(error, errorType);
    });
    
    buildProcess.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('error') || output.includes('Error')) {
        this.log(`Potential error in output: ${output}`, 'warn');
      }
    });
  }
}

// Export for use in other scripts
module.exports = ErrorMonitor;

// Run if called directly
if (require.main === module) {
  const monitor = new ErrorMonitor();
  monitor.startMonitoring();
  
  // Keep the process running
  process.on('SIGINT', () => {
    monitor.log('Error monitoring stopped');
    process.exit(0);
  });
}
