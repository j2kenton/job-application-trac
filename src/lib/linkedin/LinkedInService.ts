interface LinkedInProfile {
  id: string;
  firstName: string;
  lastName: string;
  emailAddress: string;
  profilePicture?: string;
}

interface LinkedInJobApplication {
  id: string;
  jobTitle: string;
  companyName: string;
  companyId: string;
  appliedAt: string;
  status: 'applied' | 'viewed' | 'rejected' | 'interviewing' | 'offered';
  jobUrl?: string;
  applicationUrl?: string;
  notes?: string;
}

interface LinkedInCompany {
  id: string;
  name: string;
  industry?: string;
  size?: string;
  location?: string;
  logoUrl?: string;
}

class LinkedInService {
  private accessToken: string | null = null;
  private clientId: string | null = null;
  private redirectUri: string | null = null;
  private isInitialized = false;

  constructor() {
    this.clientId = import.meta.env.VITE_LINKEDIN_CLIENT_ID || null;
    // Use current origin for redirect - LinkedIn will redirect back to the main app
    // Always use the current window's origin to handle dynamic ports in development
    this.redirectUri = window.location.origin;
  }

  /**
   * Initialize LinkedIn service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    if (!this.clientId) {
      console.warn('LinkedIn Client ID not configured');
      return;
    }

    // Initialize without loading SDK - use pure OAuth flow
    this.isInitialized = true;
  }

  /**
   * Check if user is authenticated with LinkedIn
   */
  isAuthenticated(): boolean {
    return !!this.accessToken || this.hasStoredToken();
  }

  /**
   * Check if there's a stored access token
   */
  private hasStoredToken(): boolean {
    const token = localStorage.getItem('linkedin_access_token');
    const expiry = localStorage.getItem('linkedin_token_expiry');
    
    if (!token || !expiry) return false;
    
    const now = Date.now();
    if (now > parseInt(expiry)) {
      this.clearStoredToken();
      return false;
    }
    
    this.accessToken = token;
    return true;
  }

  /**
   * Store access token securely
   */
  private storeToken(token: string, expiresIn: number): void {
    const expiry = Date.now() + (expiresIn * 1000);
    localStorage.setItem('linkedin_access_token', token);
    localStorage.setItem('linkedin_token_expiry', expiry.toString());
    this.accessToken = token;
  }

  /**
   * Clear stored token
   */
  private clearStoredToken(): void {
    localStorage.removeItem('linkedin_access_token');
    localStorage.removeItem('linkedin_token_expiry');
    this.accessToken = null;
  }

  /**
   * Initiate LinkedIn OAuth flow using popup with improved error handling
   */
  async authenticate(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.clientId) {
      throw new Error('LinkedIn Client ID not configured');
    }

    const scopes = [
      'profile',
      'email'
    ].join(' ');

    const state = this.generateState();
    const authUrl = new URL('https://www.linkedin.com/oauth/v2/authorization');
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('client_id', this.clientId);
    authUrl.searchParams.append('redirect_uri', this.redirectUri!);
    authUrl.searchParams.append('scope', scopes);
    authUrl.searchParams.append('state', state);

    // Store state for validation with timestamp to handle multiple concurrent auth attempts
    const stateData = {
      state: state,
      timestamp: Date.now(),
      redirectUri: this.redirectUri
    };
    localStorage.setItem('linkedin_oauth_state', JSON.stringify(stateData));

    console.log('LinkedIn OAuth URL:', authUrl.toString());
    console.log('Redirect URI:', this.redirectUri);
    console.log('Client ID:', this.clientId);
    console.log('Scopes:', scopes);

    return new Promise((resolve, reject) => {
      // Open popup window with additional parameters to help with LinkedIn SDK issues
      const popup = window.open(
        authUrl.toString(),
        'linkedin-auth',
        'width=600,height=700,scrollbars=yes,resizable=yes,location=yes,toolbar=no,menubar=no,status=no'
      );

      if (!popup) {
        reject(new Error('Popup was blocked. Please allow popups for this site.'));
        return;
      }

      let isResolved = false;
      let hasStartedAuth = false;

      // Add error handling for popup window
      const handlePopupError = (error: any) => {
        console.warn('LinkedIn popup encountered an error (this may be normal):', error);
        // Don't automatically reject on popup errors as they might be related to LinkedIn's internal scripts
        // Instead, continue monitoring for successful authentication
      };

      // Check for popup completion
      const checkClosed = setInterval(() => {
        if (popup.closed && !isResolved) {
          clearInterval(checkClosed);
          cleanup();
          
          // Give a brief delay to see if the authentication was successful
          // Sometimes the popup closes before we can detect the success
          setTimeout(() => {
            if (!isResolved) {
              // Check if we have a successful auth result in localStorage or URL
              const urlParams = new URLSearchParams(window.location.search);
              const code = urlParams.get('code');
              const state = urlParams.get('state');
              
              if (code && state) {
                // Success case - handle the callback
                this.handleCallback(code, state)
                  .then(() => resolve())
                  .catch(err => reject(err));
              } else if (hasStartedAuth) {
                reject(new Error('LinkedIn authentication was cancelled by user'));
              } else {
                reject(new Error('LinkedIn popup closed unexpectedly. Please try again or check for popup blockers.'));
              }
            }
          }, 500);
        }
      }, 1000);

      // Check if popup has navigated to LinkedIn (indicating authentication started)
      const checkAuthStart = setInterval(() => {
        try {
          if (popup.location && popup.location.hostname.includes('linkedin.com')) {
            hasStartedAuth = true;
            clearInterval(checkAuthStart);
          }
        } catch (error) {
          // Cross-origin error is expected when popup navigates to LinkedIn
          // This actually indicates the auth has started
          hasStartedAuth = true;
          clearInterval(checkAuthStart);
        }
      }, 500);

      // Timeout after 5 minutes
      const timeout = setTimeout(() => {
        if (!isResolved) {
          cleanup();
          popup.close();
          reject(new Error('LinkedIn authentication timed out. Please try again.'));
        }
      }, 300000); // 5 minutes

      // Listen for messages from popup
      const messageHandler = (event: MessageEvent) => {
        // Accept messages from any localhost port to handle dev server port variations
        const isLocalhost = event.origin.includes('localhost') || event.origin.includes('127.0.0.1');
        if (!isLocalhost || isResolved) return;

        if (event.data.type === 'LINKEDIN_AUTH_SUCCESS') {
          cleanup();
          popup.close();
          resolve();
        } else if (event.data.type === 'LINKEDIN_AUTH_ERROR') {
          cleanup();
          popup.close();
          reject(new Error(event.data.error || 'LinkedIn authentication failed'));
        }
      };

      let cleanup = () => {
        isResolved = true;
        clearInterval(checkClosed);
        clearInterval(checkAuthStart);
        clearTimeout(timeout);
        window.removeEventListener('message', messageHandler);
        
        // Safely remove popup event listener only if we can access the popup
        try {
          if (popup && !popup.closed) {
            popup.removeEventListener('error', handlePopupError);
          }
        } catch (e) {
          // Ignore SecurityError when popup is on different origin
          console.warn('Could not remove popup event listener (this is normal):', e.message);
        }
      };

      window.addEventListener('message', messageHandler);

      // Handle potential errors in popup (but don't fail immediately)
      // Only add listener if we can access the popup
      try {
        popup.addEventListener('error', handlePopupError);
      } catch (e) {
        console.warn('Could not add popup error listener (this is normal):', e.message);
      }

      // Monitor for successful redirect back to our app
      const checkForSuccess = setInterval(() => {
        try {
          // Check if popup has returned to our domain with auth code
          if (popup.location && popup.location.origin === window.location.origin) {
            const urlParams = new URLSearchParams(popup.location.search);
            const code = urlParams.get('code');
            const state = urlParams.get('state');
            const error = urlParams.get('error');

            if (code && state) {
              clearInterval(checkForSuccess);
              cleanup();
              popup.close();
              
              // Handle the callback
              this.handleCallback(code, state)
                .then(() => resolve())
                .catch(err => reject(err));
            } else if (error) {
              clearInterval(checkForSuccess);
              cleanup();
              popup.close();
              reject(new Error(`LinkedIn authentication error: ${error}`));
            }
          }
        } catch (e) {
          // Cross-origin access - continue monitoring
        }
      }, 1000);

      // Clean up the success check interval
      const originalCleanup = cleanup;
      cleanup = () => {
        clearInterval(checkForSuccess);
        originalCleanup();
      };
    });
  }

  /**
   * Handle OAuth callback
   */
  async handleCallback(code: string, state: string): Promise<void> {
    const storedStateData = localStorage.getItem('linkedin_oauth_state');
    
    if (!storedStateData) {
      console.warn('No stored OAuth state found');
      throw new Error('OAuth state validation failed - no stored state found');
    }

    let storedState: string;
    try {
      const stateObj = JSON.parse(storedStateData);
      storedState = stateObj.state;
      
      // Check if state is too old (older than 10 minutes)
      const stateAge = Date.now() - stateObj.timestamp;
      if (stateAge > 10 * 60 * 1000) {
        console.warn('OAuth state is too old:', { age: stateAge, timestamp: stateObj.timestamp });
        localStorage.removeItem('linkedin_oauth_state');
        throw new Error('OAuth state validation failed - state is too old, please try again');
      }
    } catch (error) {
      // Handle legacy string format
      if (typeof storedStateData === 'string' && !storedStateData.startsWith('{')) {
        storedState = storedStateData;
      } else {
        console.warn('Invalid stored OAuth state format:', storedStateData);
        localStorage.removeItem('linkedin_oauth_state');
        throw new Error('OAuth state validation failed - invalid state format');
      }
    }
    
    if (state !== storedState) {
      console.warn('OAuth state mismatch:', { received: state, stored: storedState });
      localStorage.removeItem('linkedin_oauth_state');
      throw new Error('OAuth state validation failed - possible CSRF attack or stale request');
    }

    localStorage.removeItem('linkedin_oauth_state');

    try {
      // Exchange code for access token
      const tokenResponse = await this.exchangeCodeForToken(code);
      this.storeToken(tokenResponse.access_token, tokenResponse.expires_in);
      
      // Notify parent window of successful authentication
      if (window.opener) {
        window.opener.postMessage({
          type: 'LINKEDIN_AUTH_SUCCESS',
          timestamp: Date.now()
        }, window.location.origin);
      }
    } catch (error) {
      // Notify parent window of authentication error
      if (window.opener) {
        window.opener.postMessage({
          type: 'LINKEDIN_AUTH_ERROR',
          error: error.message,
          timestamp: Date.now()
        }, window.location.origin);
      }
      throw error;
    }
  }

  /**
   * Exchange authorization code for access token
   * Uses backend service to handle the token exchange securely
   */
  private async exchangeCodeForToken(code: string): Promise<any> {
    try {
      const backendUrl = import.meta.env.VITE_LINKEDIN_BACKEND_URL || 'http://localhost:3001';
      
      console.log('Exchanging authorization code for access token via backend...');
      console.log('Authorization code received:', code.substring(0, 20) + '...');
      console.log('Backend URL:', backendUrl);
      
      const response = await fetch(`${backendUrl}/api/linkedin/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: code,
          redirect_uri: this.redirectUri
        })
      });

      const responseData = await response.json();

      if (!response.ok) {
        console.error('Backend token exchange failed:', {
          status: response.status,
          statusText: response.statusText,
          error: responseData
        });
        
        const errorMessage = responseData.error || 'Token exchange failed';
        throw new Error(`LinkedIn authentication failed: ${errorMessage}`);
      }

      console.log('LinkedIn token exchange successful:', {
        access_token: responseData.access_token ? 'received' : 'missing',
        expires_in: responseData.expires_in,
        scope: responseData.scope,
        token_type: responseData.token_type
      });

      return responseData;
      
    } catch (error) {
      console.error('Token exchange error:', error);
      
      if (error.message.includes('Failed to fetch')) {
        throw new Error('Could not connect to LinkedIn backend service. Make sure the backend is running on http://localhost:3001');
      }
      
      throw error;
    }
  }

  /**
   * Get current user's LinkedIn profile
   * Returns a simple connected status instead of making API calls
   */
  async getProfile(): Promise<LinkedInProfile | null> {
    if (!this.accessToken) return null;

    // Return a simple connected status without making API calls
    // This avoids permission issues while still showing connected state
    return {
      id: 'connected',
      firstName: 'LinkedIn',
      lastName: 'User',
      emailAddress: 'Connected',
      profilePicture: undefined
    };
  }

  /**
   * Get user's job applications from LinkedIn
   * Note: This is a mock implementation as LinkedIn doesn't provide a direct API for job applications
   */
  async getJobApplications(): Promise<LinkedInJobApplication[]> {
    // LinkedIn doesn't provide a direct API for job applications
    // This would need to be implemented through web scraping or browser automation
    // For now, return mock data structure
    
    console.warn('LinkedIn job applications API not available. Consider implementing browser automation or manual import.');
    
    return [];
  }

  /**
   * Search for companies on LinkedIn
   */
  async searchCompanies(query: string): Promise<LinkedInCompany[]> {
    if (!this.accessToken) return [];

    try {
      // Use backend proxy to avoid CORS issues
      const backendUrl = import.meta.env.VITE_LINKEDIN_BACKEND_URL || 'http://localhost:3001';
      
      const response = await fetch(`${backendUrl}/api/linkedin/companies/search`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query })
      });

      if (!response.ok) {
        console.warn('Company search failed:', response.status, response.statusText);
        return [];
      }

      const data = await response.json();
      return data || [];
    } catch (error) {
      console.error('Error searching companies:', error);
      
      if (error.message.includes('Failed to fetch')) {
        console.warn('Backend not available, company search unavailable');
      }
      
      return [];
    }
  }

  /**
   * Logout from LinkedIn
   */
  async logout(): Promise<void> {
    const tokenToRevoke = this.accessToken;
    this.clearStoredToken();
    
    // Revoke token via backend to avoid CORS
    if (tokenToRevoke) {
      try {
        const backendUrl = import.meta.env.VITE_LINKEDIN_BACKEND_URL || 'http://localhost:3001';
        
        await fetch(`${backendUrl}/api/linkedin/revoke`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${tokenToRevoke}`,
            'Content-Type': 'application/json'
          }
        });
      } catch (error) {
        console.warn('Failed to revoke LinkedIn token via backend:', error);
        // Don't throw error on logout - token clearing is more important
      }
    }
  }

  /**
   * Generate random state for OAuth
   */
  private generateState(): string {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }

  /**
   * Check if LinkedIn integration is configured
   */
  isConfigured(): boolean {
    return !!(this.clientId && import.meta.env.VITE_LINKEDIN_CLIENT_SECRET);
  }
}

export const linkedInService = new LinkedInService();
export type { LinkedInProfile, LinkedInJobApplication, LinkedInCompany };
