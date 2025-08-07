// Enhanced error monitoring script with browser console integration
const fs = require('fs');
const path = require('path');
const { exec, spawn } = require('child_process');
const WebSocket = require('ws');

class BrowserErrorMonitor {
  constructor() {
    this.logFile = path.join(__dirname, '..', 'browser-error-log.json');
    this.knownErrors = new Map();
    this.fixAttempts = new Map();
    this.maxFixAttempts = 3;
    this.chromeDebugPort = 9222;
    this.wsConnection = null;
    this.isMonitoring = false;
    this.buildProcess = null;
  }

  log(message, level = 'info', source = 'monitor') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] [${source}] ${message}`;
    console.log(logMessage);
    
    // Append to log file
    const logEntry = { timestamp, level, source, message };
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
      
      // Keep only last 200 entries (more for browser errors)
      if (logs.length > 200) {
        logs = logs.slice(-200);
      }
      
      fs.writeFileSync(this.logFile, JSON.stringify(logs, null, 2));
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  identifyErrorType(error, source = 'unknown') {
    const errorText = error.toLowerCase();
    
    // Browser-specific errors
    if (source === 'browser') {
      if (errorText.includes('uncaught referenceerror')) {
        return 'BROWSER_REFERENCE_ERROR';
      }
      if (errorText.includes('uncaught typeerror')) {
        return 'BROWSER_TYPE_ERROR';
      }
      if (errorText.includes('uncaught syntaxerror')) {
        return 'BROWSER_SYNTAX_ERROR';
      }
      if (errorText.includes('network error') || errorText.includes('failed to fetch')) {
        return 'BROWSER_NETWORK_ERROR';
      }
      if (errorText.includes('cors')) {
        return 'BROWSER_CORS_ERROR';
      }
      if (errorText.includes('linkedin') || errorText.includes('gmail')) {
        return 'BROWSER_API_ERROR';
      }
      return 'BROWSER_RUNTIME_ERROR';
    }
    
    // Build-time errors
    if (errorText.includes('module not found') || errorText.includes('cannot resolve')) {
      return 'MISSING_MODULE';
    }
    if (errorText.includes('typescript') || errorText.includes('type error')) {
      return 'TYPE_ERROR';
    }
    if (errorText.includes('syntax error') || errorText.includes('unexpected token')) {
      return 'SYNTAX_ERROR';
    }
    if (errorText.includes('import') || errorText.includes('export')) {
      return 'IMPORT_ERROR';
    }
    
    return 'UNKNOWN_ERROR';
  }

  async autoFix(error, errorType, source = 'unknown') {
    const errorKey = `${source}:${errorType}:${error.substring(0, 100)}`;
    const attempts = this.fixAttempts.get(errorKey) || 0;
    
    if (attempts >= this.maxFixAttempts) {
      this.log(`Max fix attempts reached for: ${errorKey}`, 'warn', 'autofix');
      return false;
    }
    
    this.fixAttempts.set(errorKey, attempts + 1);
    this.log(`Attempting auto-fix for ${errorType} (attempt ${attempts + 1})`, 'info', 'autofix');
    
    try {
      switch (errorType) {
        case 'MISSING_MODULE':
          return await this.fixMissingModule(error);
        case 'BROWSER_REFERENCE_ERROR':
          return await this.fixBrowserReferenceError(error);
        case 'BROWSER_TYPE_ERROR':
          return await this.fixBrowserTypeError(error);
        case 'BROWSER_NETWORK_ERROR':
          return await this.fixBrowserNetworkError(error);
        case 'BROWSER_CORS_ERROR':
          return await this.fixBrowserCorsError(error);
        case 'BROWSER_API_ERROR':
          return await this.fixBrowserApiError(error);
        default:
          this.log(`No auto-fix available for error type: ${errorType}`, 'warn', 'autofix');
          return false;
      }
    } catch (fixError) {
      this.log(`Auto-fix failed: ${fixError.message}`, 'error', 'autofix');
      return false;
    }
  }

  async fixMissingModule(error) {
    const moduleMatch = error.match(/Cannot resolve module ['"`]([^'"`]+)['"`]/);
    if (!moduleMatch) return false;
    
    const moduleName = moduleMatch[1];
    this.log(`Installing missing module: ${moduleName}`, 'info', 'npm');
    
    return new Promise((resolve) => {
      exec(`npm install ${moduleName}`, (err, stdout, stderr) => {
        if (err) {
          this.log(`Failed to install ${moduleName}: ${err.message}`, 'error', 'npm');
          resolve(false);
        } else {
          this.log(`Successfully installed ${moduleName}`, 'success', 'npm');
          resolve(true);
        }
      });
    });
  }

  async fixBrowserReferenceError(error) {
    this.log(`Browser reference error detected: ${error}`, 'warn', 'browser');
    
    // Check for common undefined variables
    if (error.includes('google') && error.includes('not defined')) {
      this.log('Google APIs not loaded - checking authentication state', 'info', 'browser');
      return this.suggestGoogleApisFix();
    }
    
    if (error.includes('linkedin') && error.includes('not defined')) {
      this.log('LinkedIn SDK not loaded - checking authentication state', 'info', 'browser');
      return this.suggestLinkedInSdkFix();
    }
    
    return false;
  }

  async fixBrowserTypeError(error) {
    this.log(`Browser type error detected: ${error}`, 'warn', 'browser');
    
    // Check for null/undefined access
    if (error.includes('null') || error.includes('undefined')) {
      this.log('Null/undefined access detected - suggesting null checks', 'info', 'browser');
      return this.suggestNullChecks(error);
    }
    
    return false;
  }

  async fixBrowserNetworkError(error) {
    this.log(`Browser network error detected: ${error}`, 'warn', 'browser');
    
    // Check if it's an API endpoint issue
    if (error.includes('localhost') || error.includes('127.0.0.1')) {
      this.log('Local server connection issue detected', 'info', 'browser');
      return this.checkLocalServers();
    }
    
    return false;
  }

  async fixBrowserCorsError(error) {
    this.log(`CORS error detected: ${error}`, 'warn', 'browser');
    this.log('CORS errors typically require server-side configuration changes', 'info', 'browser');
    return false;
  }

  async fixBrowserApiError(error) {
    this.log(`API error detected: ${error}`, 'warn', 'browser');
    
    if (error.includes('linkedin')) {
      this.log('LinkedIn API error - checking service configuration', 'info', 'browser');
      return this.checkLinkedInService();
    }
    
    if (error.includes('gmail')) {
      this.log('Gmail API error - checking service configuration', 'info', 'browser');
      return this.checkGmailService();
    }
    
    return false;
  }

  suggestGoogleApisFix() {
    this.log('Suggestion: Ensure Google APIs are loaded before using Gmail features', 'info', 'suggestion');
    return false;
  }

  suggestLinkedInSdkFix() {
    this.log('Suggestion: Check LinkedIn SDK initialization in LinkedInAuth component', 'info', 'suggestion');
    return false;
  }

  suggestNullChecks(error) {
    this.log('Suggestion: Add null/undefined checks before property access', 'info', 'suggestion');
    // Could implement automatic null check insertion here
    return false;
  }

  async checkLocalServers() {
    this.log('Checking local development servers...', 'info', 'server-check');
    
    // Check if main dev server is running
    return new Promise((resolve) => {
      exec('netstat -an | findstr :5173', (err, stdout) => {
        if (stdout.includes('5173')) {
          this.log('Main dev server (port 5173) is running', 'info', 'server-check');
        } else {
          this.log('Main dev server (port 5173) may not be running', 'warn', 'server-check');
        }
        resolve(false);
      });
    });
  }

  checkLinkedInService() {
    this.log('LinkedIn service check - verify environment variables and authentication', 'info', 'service-check');
    return false;
  }

  checkGmailService() {
    this.log('Gmail service check - verify API credentials and authentication', 'info', 'service-check');
    return false;
  }

  async connectToBrowser() {
    try {
      this.log('Attempting to connect to Chrome DevTools...', 'info', 'browser');
      
      // First, try to get the list of available targets
      const { default: fetch } = await import('node-fetch');
      const response = await fetch(`http://localhost:${this.chromeDebugPort}/json`);
      const targets = await response.json();
      
      // Find the first page target
      const pageTarget = targets.find(target => target.type === 'page');
      if (!pageTarget) {
        throw new Error('No browser page found');
      }
      
      this.log(`Connecting to browser page: ${pageTarget.title}`, 'info', 'browser');
      
      // Connect to WebSocket
      this.wsConnection = new WebSocket(pageTarget.webSocketDebuggerUrl);
      
      this.wsConnection.on('open', () => {
        this.log('Connected to Chrome DevTools Protocol', 'success', 'browser');
        this.enableRuntimeEvents();
      });
      
      this.wsConnection.on('message', (data) => {
        this.handleBrowserMessage(JSON.parse(data));
      });
      
      this.wsConnection.on('error', (error) => {
        this.log(`WebSocket error: ${error.message}`, 'error', 'browser');
      });
      
      this.wsConnection.on('close', () => {
        this.log('Disconnected from Chrome DevTools Protocol', 'warn', 'browser');
        this.wsConnection = null;
        // Attempt to reconnect after 5 seconds
        setTimeout(() => this.connectToBrowser(), 5000);
      });
      
    } catch (error) {
      this.log(`Failed to connect to browser: ${error.message}`, 'error', 'browser');
      this.log('Make sure Chrome is running with --remote-debugging-port=9222', 'info', 'browser');
      // Retry connection after 10 seconds
      setTimeout(() => this.connectToBrowser(), 10000);
    }
  }

  enableRuntimeEvents() {
    if (!this.wsConnection) return;
    
    this.log('Enabling runtime events for console monitoring...', 'info', 'browser');
    
    // Enable Runtime domain to receive console events
    this.wsConnection.send(JSON.stringify({
      id: 1,
      method: 'Runtime.enable'
    }));
    
    // Enable Log domain for console messages
    this.wsConnection.send(JSON.stringify({
      id: 2,
      method: 'Log.enable'
    }));
    
    // Enable console API called events
    this.wsConnection.send(JSON.stringify({
      id: 3,
      method: 'Runtime.setAsyncCallStackDepth',
      params: { maxDepth: 32 }
    }));
    
    // Enable Console domain
    this.wsConnection.send(JSON.stringify({
      id: 4,
      method: 'Console.enable'
    }));
    
    // Subscribe to all Runtime notifications
    this.wsConnection.send(JSON.stringify({
      id: 5,
      method: 'Runtime.addBinding',
      params: { name: 'errorMonitor' }
    }));
    
    this.log('Runtime events enabled - now monitoring for console errors', 'success', 'browser');
  }

  handleBrowserMessage(message) {
    // Log ALL incoming messages for debugging
    this.log(`DevTools message received: ${message.method || 'unknown'}`, 'info', 'browser-debug');
    
    // Handle console API calls (console.log, console.error, etc.)
    if (message.method === 'Runtime.consoleAPICalled') {
      const { type, args, timestamp } = message.params;
      
      // Log ALL console messages, not just errors
      const consoleMessage = args.map(arg => 
        arg.value || arg.description || '[Object]'
      ).join(' ');
      
      this.log(`Console ${type}: ${consoleMessage}`, type === 'error' ? 'error' : 'info', 'browser');
      
      if (type === 'error') {
        const errorType = this.identifyErrorType(consoleMessage, 'browser');
        this.autoFix(consoleMessage, errorType, 'browser');
      }
    }
    
    // Handle runtime exceptions (uncaught errors)
    if (message.method === 'Runtime.exceptionThrown') {
      const { exceptionDetails } = message.params;
      const errorMessage = exceptionDetails.exception?.description || 
                          exceptionDetails.text || 
                          'Unknown runtime exception';
      
      this.log(`Runtime exception: ${errorMessage}`, 'error', 'browser');
      
      const errorType = this.identifyErrorType(errorMessage, 'browser');
      this.autoFix(errorMessage, errorType, 'browser');
    }
    
    // Handle Log domain entries (browser console messages)
    if (message.method === 'Log.entryAdded') {
      const { entry } = message.params;
      this.log(`Log entry: ${entry.level} - ${entry.text}`, entry.level === 'error' ? 'error' : 'info', 'browser');
      
      if (entry.level === 'error') {
        const errorType = this.identifyErrorType(entry.text, 'browser');
        this.autoFix(entry.text, errorType, 'browser');
      }
    }
    
    // Handle Console domain messages
    if (message.method === 'Console.messageAdded') {
      const { message: consoleMsg } = message.params;
      this.log(`Console message: ${consoleMsg.level} - ${consoleMsg.text}`, consoleMsg.level === 'error' ? 'error' : 'info', 'browser');
      
      if (consoleMsg.level === 'error') {
        const errorType = this.identifyErrorType(consoleMsg.text, 'browser');
        this.autoFix(consoleMsg.text, errorType, 'browser');
      }
    }
    
    // Log any response messages for debugging
    if (message.id && message.result) {
      this.log(`DevTools command response: ${JSON.stringify(message)}`, 'info', 'browser-debug');
    }
  }

  monitorBuildProcess() {
    this.log('Starting build process monitoring...', 'info', 'build');
    
    // Monitor for build errors
    this.buildProcess = spawn('npm', ['run', 'dev'], {
      cwd: path.join(__dirname, '..'),
      stdio: 'pipe'
    });
    
    this.buildProcess.stderr.on('data', (data) => {
      const error = data.toString();
      this.log(`Build error detected: ${error}`, 'error', 'build');
      
      const errorType = this.identifyErrorType(error, 'build');
      this.autoFix(error, errorType, 'build');
    });
    
    this.buildProcess.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('error') || output.includes('Error')) {
        this.log(`Potential build issue: ${output}`, 'warn', 'build');
      }
      
      // Log successful starts
      if (output.includes('Local:') && output.includes('5173')) {
        this.log('Development server started successfully', 'success', 'build');
      }
    });
    
    this.buildProcess.on('error', (error) => {
      this.log(`Build process error: ${error.message}`, 'error', 'build');
    });
  }

  async startMonitoring() {
    this.log('Enhanced browser error monitoring system started', 'info', 'monitor');
    this.isMonitoring = true;
    
    // Start build process monitoring
    this.monitorBuildProcess();
    
    // Wait a bit for dev server to start, then connect to browser
    setTimeout(() => {
      this.connectToBrowser();
    }, 3000);
    
    this.log('Monitoring both build errors and browser console errors', 'info', 'monitor');
    this.log('To enable browser monitoring, start Chrome with: chrome --remote-debugging-port=9222', 'info', 'monitor');
  }

  stopMonitoring() {
    this.log('Stopping error monitoring...', 'info', 'monitor');
    this.isMonitoring = false;
    
    if (this.wsConnection) {
      this.wsConnection.close();
    }
    
    if (this.buildProcess) {
      this.buildProcess.kill();
    }
  }
}

// Export for use in other scripts
module.exports = BrowserErrorMonitor;

// Run if called directly
if (require.main === module) {
  const monitor = new BrowserErrorMonitor();
  monitor.startMonitoring();
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    monitor.log('Received SIGINT, shutting down gracefully...', 'info', 'monitor');
    monitor.stopMonitoring();
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    monitor.log('Received SIGTERM, shutting down gracefully...', 'info', 'monitor');
    monitor.stopMonitoring();
    process.exit(0);
  });
}
