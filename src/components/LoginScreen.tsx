import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';
import { Briefcase, Envelope, Warning, Info, Sparkle, TrendUp, Gear } from '@phosphor-icons/react';
import { toast } from 'sonner';

export function LoginScreen() {
  const { login } = useAuth();
  const [isConnecting, setIsConnecting] = useState(false);
  const [showPopupWarning, setShowPopupWarning] = useState(false);

  const handleLogin = async () => {
    setIsConnecting(true);
    setShowPopupWarning(false);

    try {
      await login();
      toast.success('Welcome to Job Application Tracker!');
    } catch (error: any) {
      console.error('Login error:', error);
      
      if (error.message.includes('Popup was blocked')) {
        setShowPopupWarning(true);
        toast.error('Please allow popups for this site and try again.');
      } else if (error.message.includes('cancelled')) {
        toast.info('Login was cancelled.');
      } else if (error.message.includes('Client ID not configured')) {
        toast.error('Application not configured. Please check your environment variables.');
      } else {
        toast.error('Login failed. Please try again.');
      }
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo and Header */}
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="p-4 bg-primary text-primary-foreground rounded-xl shadow-lg">
              <Briefcase size={40} />
            </div>
          </div>
          
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-white">
              Job Application Tracker
            </h1>
            <p className="text-white/90">
              AI-powered job application management with email sync
            </p>
          </div>
        </div>

        {/* Features Preview */}
        <div className="grid grid-cols-1 gap-3">
          <div className="flex items-center gap-3 p-3 bg-white/20 dark:bg-slate-800/50 rounded-lg backdrop-blur-sm">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <Envelope size={20} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="font-medium text-sm text-white">Gmail Integration</p>
              <p className="text-xs text-white/80">Auto-sync job emails</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 p-3 bg-white/20 dark:bg-slate-800/50 rounded-lg backdrop-blur-sm">
            <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
              <Sparkle size={20} className="text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="font-medium text-sm text-white">AI Email Parsing</p>
              <p className="text-xs text-white/80">Smart application tracking</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 p-3 bg-white/20 dark:bg-slate-800/50 rounded-lg backdrop-blur-sm">
            <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
              <TrendUp size={20} className="text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="font-medium text-sm text-white">Status Tracking</p>
              <p className="text-xs text-white/80">Interview & offer management</p>
            </div>
          </div>
        </div>

        {/* Login Card */}
        <Card className="shadow-xl border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl text-white">Sign in to get started</CardTitle>
            <p className="text-sm text-white/80">
              Connect with your Gmail account to begin tracking your job applications
            </p>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {showPopupWarning && (
              <Alert className="border-orange-200 bg-orange-50 dark:bg-orange-950">
                <Warning className="h-4 w-4 text-orange-600" />
                <AlertDescription className="text-orange-800 dark:text-orange-200">
                  <strong>Popup blocked!</strong> Please allow popups for this site in your browser settings, then try again.
                  <br />
                  <span className="text-xs mt-1 block opacity-75">
                    Usually found in your browser's address bar or settings.
                  </span>
                </AlertDescription>
              </Alert>
            )}

            {import.meta.env.VITE_GOOGLE_CLIENT_ID ? (
              <Button 
                onClick={handleLogin} 
                disabled={isConnecting}
                className="w-full h-12 gap-3 text-base font-medium bg-[#4285F4] hover:bg-[#3367D6] text-white"
                size="lg"
              >
                {isConnecting ? (
                  <>
                    <div className="animate-spin w-5 h-5 border-2 border-current border-t-transparent rounded-full" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <svg width="20" height="20" viewBox="0 0 24 24" className="fill-current">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    Continue with Gmail
                  </>
                )}
              </Button>
            ) : (
              <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950">
                <Info className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800 dark:text-blue-200">
                  <strong>Setup Required:</strong> Google Client ID not configured.
                  <br />
                  <span className="text-xs mt-1 block">
                    Add <code>VITE_GOOGLE_CLIENT_ID=your_client_id_here</code> to your <code>.env.local</code> file.
                  </span>
                </AlertDescription>
              </Alert>
            )}

            {!isConnecting && (
              <p className="text-xs text-center text-white/60">
                Make sure popups are allowed for this site
              </p>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-xs text-white/70 space-y-1">
          <p>Secure authentication powered by Google</p>
          <p>Your data is private and never shared</p>
        </div>
      </div>
    </div>
  );
}
