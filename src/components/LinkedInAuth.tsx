import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Loader2, LogIn, LogOut, User, Building, AlertCircle, Info } from 'lucide-react';
import { linkedInService, LinkedInProfile } from '../lib/linkedin/LinkedInService';
import { toast } from 'sonner';

interface LinkedInAuthProps {
  onProfileUpdate?: (profile: LinkedInProfile | null) => void;
}

export function LinkedInAuth({ onProfileUpdate }: LinkedInAuthProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [profile, setProfile] = useState<LinkedInProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);
  const [showPopupWarning, setShowPopupWarning] = useState(false);

  useEffect(() => {
    checkConfiguration();
    checkAuthStatus();
    handleOAuthCallback();
    
    // Listen for LinkedIn authentication success from popup
    const handleMessage = (event: MessageEvent) => {
      const isLocalhost = event.origin.includes('localhost') || event.origin.includes('127.0.0.1');
      if (!isLocalhost) return;

      if (event.data.type === 'LINKEDIN_AUTH_SUCCESS') {
        console.log('LinkedIn authentication successful, updating UI...');
        toast.success('Successfully connected to LinkedIn!');
        setError(null);
        // Refresh authentication status after successful popup authentication
        setTimeout(() => {
          checkAuthStatus();
        }, 1000); // Small delay to ensure token is stored
      } else if (event.data.type === 'LINKEDIN_AUTH_ERROR') {
        console.error('LinkedIn authentication failed:', event.data.error);
        toast.error('LinkedIn authentication failed: ' + (event.data.error || 'Unknown error'));
        setError(event.data.error || 'LinkedIn authentication failed');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const checkConfiguration = () => {
    setIsConfigured(linkedInService.isConfigured());
  };

  const checkAuthStatus = async () => {
    if (linkedInService.isAuthenticated()) {
      setIsLoading(true);
      try {
        await linkedInService.initialize();
        // Skip profile fetching - just show connected status
        const mockProfile = {
          id: 'connected',
          firstName: 'LinkedIn',
          lastName: 'User',
          emailAddress: 'Connected',
          profilePicture: undefined
        };
        setProfile(mockProfile);
        onProfileUpdate?.(mockProfile);
      } catch (error) {
        console.error('Error checking LinkedIn auth status:', error);
        setError('Failed to verify LinkedIn authentication');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleOAuthCallback = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const error = urlParams.get('error');

    if (error) {
      setError(`LinkedIn authentication error: ${error}`);
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    if (code && state) {
      setIsLoading(true);
      try {
        await linkedInService.handleCallback(code, state);
        // Skip profile fetching - just show connected status
        const mockProfile = {
          id: 'connected',
          firstName: 'LinkedIn',
          lastName: 'User',
          emailAddress: 'Connected',
          profilePicture: undefined
        };
        setProfile(mockProfile);
        onProfileUpdate?.(mockProfile);
        setError(null);
        
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch (error) {
        console.error('Error handling LinkedIn OAuth callback:', error);
        setError('Failed to complete LinkedIn authentication');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleLogin = async () => {
    setIsLoading(true);
    setError(null);
    setShowPopupWarning(false);

    try {
      await linkedInService.authenticate();
      toast.success('Successfully connected to LinkedIn!');
    } catch (error: any) {
      console.error('LinkedIn connection error:', error);
      
      if (error.message.includes('Popup was blocked')) {
        setShowPopupWarning(true);
        toast.error('Please allow popups for this site and try again.');
      } else if (error.message.includes('cancelled by user')) {
        toast.info('LinkedIn connection was cancelled.');
      } else if (error.message.includes('popup closed unexpectedly')) {
        setShowPopupWarning(true);
        toast.error('Popup closed unexpectedly. Please check for popup blockers and try again.');
      } else if (error.message.includes('Client ID not configured')) {
        toast.error('LinkedIn integration not configured. Please check your environment variables.');
      } else if (error.message.includes('backend service')) {
        toast.warning('LinkedIn authentication requires backend setup for full functionality.');
        setError('LinkedIn authentication started but requires backend service to complete token exchange.');
      } else {
        toast.error('Failed to connect to LinkedIn. Please try again.');
      }
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      await linkedInService.logout();
      setProfile(null);
      onProfileUpdate?.(null);
      setError(null);
    } catch (error) {
      console.error('Error logging out from LinkedIn:', error);
      setError('Failed to logout from LinkedIn');
    } finally {
      setIsLoading(false);
    }
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  if (!isConfigured) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="w-5 h-5" />
            LinkedIn Integration
          </CardTitle>
          <CardDescription>
            Connect your LinkedIn account to enhance job application tracking
          </CardDescription>
        </CardHeader>
        <CardContent>
            <Alert>
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>
              LinkedIn integration is not configured. Please add your LinkedIn Client ID and Secret to your environment variables.
              <br />
              <br />
              <strong>Required environment variables:</strong>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li><code>VITE_LINKEDIN_CLIENT_ID</code></li>
                <li><code>VITE_LINKEDIN_CLIENT_SECRET</code></li>
                <li><code>VITE_LINKEDIN_REDIRECT_URI</code> (should be <code>http://localhost:5173</code>)</li>
              </ul>
              <br />
              <strong>Important:</strong> Make sure to add <code>http://localhost:5173</code> to the Authorized redirect URLs in your LinkedIn app settings at <a href="https://www.linkedin.com/developers/apps" target="_blank" className="text-blue-600 underline">LinkedIn Developer Console</a>.
              <br />
              <br />
              <strong>Note:</strong> LinkedIn OAuth requires a backend service for token exchange due to CORS security restrictions. This frontend implementation demonstrates the OAuth flow but requires backend completion.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building className="w-5 h-5" />
          LinkedIn Integration
        </CardTitle>
        <CardDescription>
          Connect your LinkedIn account to enhance job application tracking
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {profile ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarImage src={profile.profilePicture} alt="Profile" />
                <AvatarFallback>
                  <User className="w-4 h-4" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="font-medium">
                  {profile.firstName} {profile.lastName}
                </div>
                <div className="text-sm text-muted-foreground">
                  {profile.emailAddress}
                </div>
              </div>
              <Badge variant="secondary">Connected</Badge>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleLogout}
                disabled={isLoading}
                className="flex-1"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Disconnecting...
                  </>
                ) : (
                  <>
                    <LogOut className="w-4 h-4 mr-2" />
                    Disconnect
                  </>
                )}
              </Button>
            </div>

            <div className="text-sm text-muted-foreground">
              <p>✅ LinkedIn profile connected</p>
              <p>✅ Ready to enhance company data</p>
              <p className="text-yellow-600">ℹ️ Direct job application sync not available via LinkedIn API</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground space-y-2">
              <p>Connect your LinkedIn account to:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Auto-fill company information</li>
                <li>Enhance job application data</li>
                <li>Access your professional network</li>
                <li>Get company insights and details</li>
              </ul>
            </div>

            {showPopupWarning && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Popup blocked!</strong> Please allow popups for this site in your browser settings, then try again.
                  <br />
                  <span className="text-xs text-muted-foreground mt-1 block">
                    Usually found in your browser's address bar (popup blocked icon) or settings.
                  </span>
                </AlertDescription>
              </Alert>
            )}

            <Button
              onClick={handleLogin}
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4 mr-2" />
                  Connect LinkedIn
                </>
              )}
            </Button>

            {!isLoading && (
              <p className="text-xs text-muted-foreground text-center">
                Make sure popups are allowed for this site
              </p>
            )}

            <div className="text-xs text-muted-foreground">
              <p>
                <strong>Note:</strong> LinkedIn's API doesn't provide direct access to job applications. 
                This integration helps with company data and professional networking features.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
