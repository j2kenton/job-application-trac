// Define Google Identity Services types
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          prompt: () => void;
          renderButton: (element: HTMLElement, config: any) => void;
        };
        oauth2: {
          initTokenClient: (config: any) => {
            requestAccessToken: () => void;
          };
        };
      };
    };
    gapi?: {
      load: (apis: string, callback: () => void) => void;
      client: {
        init: (config: any) => Promise<void>;
        getToken: () => { access_token: string } | null;
        setToken: (token: { access_token: string }) => void;
        gmail: {
          users: {
            messages: {
              list: (params: any) => Promise<any>;
              get: (params: any) => Promise<any>;
              modify: (params: any) => Promise<any>;
            };
            labels: {
              list: (params: any) => Promise<any>;
              create: (params: any) => Promise<any>;
            };
          };
        };
      };
    };
  }
}

interface AuthState {
  isAuthenticated: boolean;
  user: any | null;
  accessToken: string | null;
}

interface GoogleUser {
  email: string;
  name: string;
  picture: string;
  sub: string;
}

class GmailAuthService {
  private static instance: GmailAuthService;
  private authState: AuthState = {
    isAuthenticated: false,
    user: null,
    accessToken: null
  };
  private listeners: Array<(state: AuthState) => void> = [];
  private tokenClient: any = null;
  private isInitialized = false;

  private constructor() {
    this.loadGoogleAPIs();
  }

  static getInstance(): GmailAuthService {
    if (!GmailAuthService.instance) {
      GmailAuthService.instance = new GmailAuthService();
    }
    return GmailAuthService.instance;
  }

  private async loadGoogleAPIs(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Load Google Identity Services
      const gisScript = document.createElement('script');
      gisScript.src = 'https://accounts.google.com/gsi/client';
      gisScript.onload = () => {
        // Load Google API Client
        const gapiScript = document.createElement('script');
        gapiScript.src = 'https://apis.google.com/js/api.js';
        gapiScript.onload = () => {
          this.initializeGoogleServices();
          resolve();
        };
        gapiScript.onerror = reject;
        document.head.appendChild(gapiScript);
      };
      gisScript.onerror = reject;
      document.head.appendChild(gisScript);
    });
  }

  private async initializeGoogleServices(): Promise<void> {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    
    if (!clientId) {
      throw new Error('Google Client ID not configured. Please set VITE_GOOGLE_CLIENT_ID in your .env.local file.');
    }

    // Initialize GAPI
    await new Promise<void>((resolve) => {
      window.gapi?.load('client', async () => {
        await window.gapi.client.init({
          apiKey: import.meta.env.VITE_GOOGLE_API_KEY,
          discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest']
        });
        resolve();
      });
    });

    // Initialize OAuth2 token client
    this.tokenClient = window.google?.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.labels https://www.googleapis.com/auth/gmail.modify',
      callback: (response: any) => {
        if (response.access_token) {
          this.handleAuthSuccess(response.access_token);
        }
      },
    });

    this.isInitialized = true;
    
    // Check if user is already authenticated
    await this.checkAuthStatus();
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.authState));
  }

  subscribe(listener: (state: AuthState) => void): () => void {
    this.listeners.push(listener);
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  async authenticate(): Promise<boolean> {
    try {
      if (!this.isInitialized) {
        await this.initializeGoogleServices();
      }

      return new Promise((resolve, reject) => {
        // Set up callback for this specific authentication attempt
        this.tokenClient.callback = (response: any) => {
          if (response.access_token) {
            this.handleAuthSuccess(response.access_token);
            resolve(true);
          } else {
            reject(new Error('Failed to get access token'));
          }
        };

        // Request access token
        this.tokenClient.requestAccessToken();
      });

    } catch (error) {
      console.error('Gmail authentication error:', error);
      throw error;
    }
  }

  private async handleAuthSuccess(accessToken: string): Promise<void> {
    try {
      // Set the token in GAPI client
      window.gapi?.client.setToken({ access_token: accessToken });

      // Get user info
      const response = await fetch(`https://www.googleapis.com/oauth2/v2/userinfo?access_token=${accessToken}`);
      const userInfo = await response.json();

      this.authState = {
        isAuthenticated: true,
        user: {
          email: userInfo.email,
          name: userInfo.name,
          picture: userInfo.picture,
          sub: userInfo.id
        },
        accessToken: accessToken
      };

      // Store tokens securely
      this.storeTokens(accessToken);
      this.notifyListeners();

    } catch (error) {
      console.error('Error handling auth success:', error);
      throw error;
    }
  }

  async signOut(): Promise<void> {
    try {
      // Revoke the token
      if (this.authState.accessToken) {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${this.authState.accessToken}`, {
          method: 'POST',
          headers: {
            'Content-type': 'application/x-www-form-urlencoded'
          }
        });
      }

      // Clear stored tokens
      localStorage.removeItem('gmail_access_token');
      localStorage.removeItem('gmail_user');

      // Clear GAPI token
      window.gapi?.client.setToken({ access_token: '' });

      // Reset auth state
      this.authState = {
        isAuthenticated: false,
        user: null,
        accessToken: null
      };

      this.notifyListeners();
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  }

  async checkAuthStatus(): Promise<boolean> {
    try {
      const storedToken = localStorage.getItem('gmail_access_token');
      const storedUser = localStorage.getItem('gmail_user');

      if (storedToken && storedUser) {
        // Verify token is still valid
        const response = await fetch(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${storedToken}`);
        
        if (response.ok) {
          const tokenInfo = await response.json();
          
          // Check if token is expired
          if (tokenInfo.expires_in && tokenInfo.expires_in > 0) {
            this.authState = {
              isAuthenticated: true,
              user: JSON.parse(storedUser),
              accessToken: storedToken
            };

            // Set the token in GAPI client
            window.gapi?.client.setToken({ access_token: storedToken });
            
            this.notifyListeners();
            return true;
          }
        }
      }

      return false;
    } catch (error) {
      console.error('Auth status check error:', error);
      return false;
    }
  }

  private storeTokens(accessToken: string): void {
    // In a production app, these should be encrypted
    localStorage.setItem('gmail_access_token', accessToken);
    localStorage.setItem('gmail_user', JSON.stringify(this.authState.user));
  }

  getAuthState(): AuthState {
    return { ...this.authState };
  }

  getAccessToken(): string | null {
    return this.authState.accessToken;
  }

  // Helper method to get GAPI client for Gmail operations
  getGmailClient() {
    if (!this.authState.isAuthenticated || !window.gapi?.client) {
      throw new Error('Not authenticated or GAPI not initialized');
    }
    return window.gapi.client;
  }
}

export const gmailAuth = GmailAuthService.getInstance();
export type { AuthState, GoogleUser };
