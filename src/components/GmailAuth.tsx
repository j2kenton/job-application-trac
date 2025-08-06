import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { gmailAuth, AuthState } from '@/lib/gmail/GmailAuth';
import { Envelope, Gear, CheckCircle, Warning, Info } from '@phosphor-icons/react';
import { toast } from 'sonner';

interface GmailAuthProps {
  onAuthStateChange?: (isAuthenticated: boolean) => void;
}

export function GmailAuth({ onAuthStateChange }: GmailAuthProps) {
  const [authState, setAuthState] = useState<AuthState>(gmailAuth.getAuthState());
  const [isConnecting, setIsConnecting] = useState(false);
  const [showPopupWarning, setShowPopupWarning] = useState(false);

  useEffect(() => {
    // Check auth status on mount
    gmailAuth.checkAuthStatus();

    // Subscribe to auth state changes
    const unsubscribe = gmailAuth.subscribe((state) => {
      setAuthState(state);
      onAuthStateChange?.(state.isAuthenticated);
    });

    return unsubscribe;
  }, [onAuthStateChange]);

  const handleConnect = async () => {
    setIsConnecting(true);
    setShowPopupWarning(false);

    try {
      await gmailAuth.authenticate();
      toast.success('Successfully connected to Gmail!');
    } catch (error: any) {
      console.error('Gmail connection error:', error);
      
      if (error.message.includes('Popup was blocked')) {
        setShowPopupWarning(true);
        toast.error('Please allow popups for this site and try again.');
      } else if (error.message.includes('cancelled')) {
        toast.info('Gmail connection was cancelled.');
      } else if (error.message.includes('Client ID not configured')) {
        toast.error('Gmail integration not configured. Please check your environment variables.');
      } else {
        toast.error('Failed to connect to Gmail. Please try again.');
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await gmailAuth.signOut();
      toast.success('Disconnected from Gmail.');
    } catch (error) {
      toast.error('Error disconnecting from Gmail.');
    }
  };

  const getStatusColor = () => {
    if (authState.isAuthenticated) return 'text-green-600';
    return 'text-gray-500';
  };

  const getStatusIcon = () => {
    if (authState.isAuthenticated) {
      return <CheckCircle size={20} className="text-green-600" />;
    }
    return <Envelope size={20} className="text-gray-500" />;
  };

  return (
    <Card className="border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {getStatusIcon()}
          Gmail Integration
          {authState.isAuthenticated ? (
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              Connected
            </Badge>
          ) : (
            <Badge variant="outline">Not Connected</Badge>
          )}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {!authState.isAuthenticated ? (
          <>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Connect your Gmail account to automatically sync job application emails.
              </p>
              
              {showPopupWarning && (
                <Alert>
                  <Warning className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Popup blocked!</strong> Please allow popups for this site in your browser settings, then try again.
                    <br />
                    <span className="text-xs text-muted-foreground mt-1 block">
                      Usually found in your browser's address bar (popup blocked icon) or settings.
                    </span>
                  </AlertDescription>
                </Alert>
              )}

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  <strong>Setup Required:</strong> You'll need to configure your Google Client ID in <code>.env.local</code>.
                  <br />
                  Add: <code>VITE_GOOGLE_CLIENT_ID=your_client_id_here</code>
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Button 
                  onClick={handleConnect} 
                  disabled={isConnecting}
                  className="w-full gap-2"
                >
                  {isConnecting ? (
                    <>
                      <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Envelope size={16} />
                      Connect Gmail Account
                    </>
                  )}
                </Button>
                
                {!isConnecting && (
                  <p className="text-xs text-muted-foreground text-center">
                    Make sure popups are allowed for this site
                  </p>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Connected Account</p>
                <p className="text-xs text-muted-foreground">
                  {authState.user?.email || 'Gmail account connected'}
                </p>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleDisconnect}
                className="gap-2"
              >
                <Gear size={14} />
                Disconnect
              </Button>
            </div>

            <Alert className="bg-green-50 border-green-200">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                <strong>Ready for email sync!</strong> Your Gmail account is connected and ready to process job application emails.
              </AlertDescription>
            </Alert>

            <div className="text-xs text-muted-foreground space-y-1">
              <p><strong>What happens next:</strong></p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Daily sync at 9:00 AM Israel time</li>
                <li>AI processes emails for job opportunities</li>
                <li>Adds "_interviews_tracked" label to processed emails</li>
                <li>Updates existing applications instead of duplicating</li>
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
