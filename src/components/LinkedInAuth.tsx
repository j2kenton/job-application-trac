import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Loader2, LogIn, LogOut, User, Building, AlertCircle } from 'lucide-react';
import { linkedInService, LinkedInProfile } from '../lib/linkedin/LinkedInService';

interface LinkedInAuthProps {
  onProfileUpdate?: (profile: LinkedInProfile | null) => void;
}

export function LinkedInAuth({ onProfileUpdate }: LinkedInAuthProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [profile, setProfile] = useState<LinkedInProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);

  useEffect(() => {
    checkConfiguration();
    checkAuthStatus();
    handleOAuthCallback();
  }, []);

  const checkConfiguration = () => {
    setIsConfigured(linkedInService.isConfigured());
  };

  const checkAuthStatus = async () => {
    if (linkedInService.isAuthenticated()) {
      setIsLoading(true);
      try {
        await linkedInService.initialize();
        const userProfile = await linkedInService.getProfile();
        setProfile(userProfile);
        onProfileUpdate?.(userProfile);
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
        const userProfile = await linkedInService.getProfile();
        setProfile(userProfile);
        onProfileUpdate?.(userProfile);
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
    try {
      await linkedInService.authenticate();
    } catch (error) {
      console.error('Error authenticating with LinkedIn:', error);
      setError('Failed to authenticate with LinkedIn');
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
                <li><code>VITE_LINKEDIN_REDIRECT_URI</code> (optional)</li>
              </ul>
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
