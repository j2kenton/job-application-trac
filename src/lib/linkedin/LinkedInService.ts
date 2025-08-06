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
    this.redirectUri = import.meta.env.VITE_LINKEDIN_REDIRECT_URI || `${window.location.origin}/linkedin/callback`;
  }

  /**
   * Initialize LinkedIn SDK
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    if (!this.clientId) {
      console.warn('LinkedIn Client ID not configured');
      return;
    }

    // Load LinkedIn SDK
    await this.loadLinkedInSDK();
    this.isInitialized = true;
  }

  /**
   * Load LinkedIn SDK script
   */
  private loadLinkedInSDK(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (document.getElementById('linkedin-sdk')) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.id = 'linkedin-sdk';
      script.src = 'https://platform.linkedin.com/in.js';
      script.async = true;
      script.defer = true;
      
      script.onload = () => {
        // Initialize LinkedIn API
        if (window.IN) {
          window.IN.init({
            api_key: this.clientId,
            authorize: true,
            onLoad: 'onLinkedInLoad'
          });
        }
        resolve();
      };
      
      script.onerror = () => reject(new Error('Failed to load LinkedIn SDK'));
      document.head.appendChild(script);
    });
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
   * Initiate LinkedIn OAuth flow
   */
  async authenticate(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.clientId) {
      throw new Error('LinkedIn Client ID not configured');
    }

    const scopes = [
      'r_liteprofile',
      'r_emailaddress',
      'w_member_social'
    ].join(' ');

    const authUrl = new URL('https://www.linkedin.com/oauth/v2/authorization');
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('client_id', this.clientId);
    authUrl.searchParams.append('redirect_uri', this.redirectUri!);
    authUrl.searchParams.append('scope', scopes);
    authUrl.searchParams.append('state', this.generateState());

    // Store state for validation
    localStorage.setItem('linkedin_oauth_state', authUrl.searchParams.get('state')!);

    // Redirect to LinkedIn authorization
    window.location.href = authUrl.toString();
  }

  /**
   * Handle OAuth callback
   */
  async handleCallback(code: string, state: string): Promise<void> {
    const storedState = localStorage.getItem('linkedin_oauth_state');
    
    if (state !== storedState) {
      throw new Error('Invalid OAuth state parameter');
    }

    localStorage.removeItem('linkedin_oauth_state');

    // Exchange code for access token
    const tokenResponse = await this.exchangeCodeForToken(code);
    this.storeToken(tokenResponse.access_token, tokenResponse.expires_in);
  }

  /**
   * Exchange authorization code for access token
   */
  private async exchangeCodeForToken(code: string): Promise<any> {
    const response = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: this.redirectUri!,
        client_id: this.clientId!,
        client_secret: import.meta.env.VITE_LINKEDIN_CLIENT_SECRET || ''
      })
    });

    if (!response.ok) {
      throw new Error('Failed to exchange code for token');
    }

    return response.json();
  }

  /**
   * Get current user's LinkedIn profile
   */
  async getProfile(): Promise<LinkedInProfile | null> {
    if (!this.accessToken) return null;

    try {
      const response = await fetch('https://api.linkedin.com/v2/people/~?projection=(id,firstName,lastName,emailAddress,profilePicture(displayImage~:playableStreams))', {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch LinkedIn profile');
      }

      const data = await response.json();
      
      return {
        id: data.id,
        firstName: data.firstName?.localized?.en_US || '',
        lastName: data.lastName?.localized?.en_US || '',
        emailAddress: data.emailAddress,
        profilePicture: data.profilePicture?.displayImage?.elements?.[0]?.identifiers?.[0]?.identifier
      };
    } catch (error) {
      console.error('Error fetching LinkedIn profile:', error);
      return null;
    }
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
      // Note: This endpoint may require additional permissions
      const response = await fetch(`https://api.linkedin.com/v2/companySearch?q=text&text=${encodeURIComponent(query)}`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to search companies');
      }

      const data = await response.json();
      
      return data.elements?.map((company: any) => ({
        id: company.id,
        name: company.name,
        industry: company.industry,
        size: company.size,
        location: company.location?.country,
        logoUrl: company.logo?.image
      })) || [];
    } catch (error) {
      console.error('Error searching companies:', error);
      return [];
    }
  }

  /**
   * Logout from LinkedIn
   */
  async logout(): Promise<void> {
    this.clearStoredToken();
    
    // Revoke token if possible
    if (this.accessToken) {
      try {
        await fetch('https://api.linkedin.com/v2/oauth2/revoke', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            token: this.accessToken,
            client_id: this.clientId!,
            client_secret: import.meta.env.VITE_LINKEDIN_CLIENT_SECRET || ''
          })
        });
      } catch (error) {
        console.warn('Failed to revoke LinkedIn token:', error);
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

// Global declaration for LinkedIn SDK
declare global {
  interface Window {
    IN: any;
    onLinkedInLoad?: () => void;
  }
}

export const linkedInService = new LinkedInService();
export type { LinkedInProfile, LinkedInJobApplication, LinkedInCompany };
