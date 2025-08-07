import { ApplicationList } from './ApplicationList';
import { ThemeToggle } from './ThemeToggle';
import { GmailAuth } from './GmailAuth';
import { GmailSyncStatus } from './GmailSyncStatus';
import { LinkedInAuth } from './LinkedInAuth';
import { LinkedInSyncStatus } from './LinkedInSyncStatus';
import { EmailReviewQueue } from './EmailReviewQueue';
import { UserProfile } from './UserProfile';
import { JobApplication, ApplicationStatus } from '../lib/types';
import { syncScheduler } from '../lib/gmail/SyncScheduler';
import { Briefcase, TrendUp, Gear, Envelope, LinkedinLogo } from '@phosphor-icons/react';
import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export function MainApp() {
  const [applications, setApplications] = useState<JobApplication[]>(() => {
    try {
      const saved = localStorage.getItem('job-applications');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [reviewQueueCount, setReviewQueueCount] = useState(0);
  const [activeTab, setActiveTab] = useState('applications');
  const [statusFilters, setStatusFilters] = useState<ApplicationStatus[]>([]);

  useEffect(() => {
    localStorage.setItem('job-applications', JSON.stringify(applications));
  }, [applications]);

  // Update review queue count
  useEffect(() => {
    const updateReviewQueueCount = () => {
      const queue = syncScheduler.getReviewQueue();
      setReviewQueueCount(queue.length);
    };

    // Initial count
    updateReviewQueueCount();

    // Set up interval to check for changes
    const interval = setInterval(updateReviewQueueCount, 2000); // Check every 2 seconds

    return () => clearInterval(interval);
  }, []);

  // Perform initial sync on app start
  useEffect(() => {
    const performInitialSync = async () => {
      try {
        await syncScheduler.performInitialSync(handleAddApplication);
      } catch (error) {
        console.error('Initial sync failed:', error);
      }
    };

    performInitialSync();
  }, []);

  // Handle external errors (browser extensions, etc.)
  useEffect(() => {
    const handleGlobalError = (event: ErrorEvent) => {
      // Suppress browser extension errors that don't affect our functionality
      if (event.message && (
        event.message.includes('message channel closed') ||
        event.message.includes('listener indicated an asynchronous response') ||
        event.message.includes('chrome-extension://') ||
        event.message.includes('moz-extension://') ||
        event.message.includes('Google API') ||
        event.message.includes('GAPI') ||
        event.message.includes('gapi is not defined') ||
        event.message.includes('google is not defined') ||
        event.message.includes('Cross-Origin-Opener-Policy') ||
        event.message.includes('window.opener call') ||
        event.message.includes('Cross-Origin-Opener-Policy policy would block the window.opener call') ||
        event.message.includes('gmail/v1/rest') ||
        event.message.includes('oauth2/v2/userinfo') ||
        event.message.includes('discovery/v1/apis/gmail') ||
        event.message.includes('Discovery.GetDiscoveryRest are blocked') ||
        event.message.includes('403') ||
        event.message.includes('401') ||
        event.message.includes('Forbidden') ||
        event.message.includes('Unauthorized')
      )) {
        event.preventDefault();
        return false;
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      // Suppress browser extension promise rejections
      const reason = event.reason;
      if (reason && (
        (typeof reason === 'string' && (
          reason.includes('message channel closed') ||
          reason.includes('listener indicated an asynchronous response') ||
          reason.includes('Could not establish connection') ||
          reason.includes('Receiving end does not exist')
        )) ||
        (reason instanceof Error && (
          reason.message.includes('message channel closed') ||
          reason.message.includes('listener indicated an asynchronous response') ||
          reason.message.includes('Could not establish connection') ||
          reason.message.includes('Receiving end does not exist')
        ))
      )) {
        event.preventDefault();
        return false;
      }
    };

    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  // Handle LinkedIn OAuth callback in popup
  useEffect(() => {
    const handleLinkedInCallback = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');
        const error = urlParams.get('error');

        // Check if this is a LinkedIn OAuth callback
        if (code && state) {
          try {
            // Import LinkedIn service dynamically to avoid circular imports
            const { linkedInService } = await import('../lib/linkedin/LinkedInService');
            
            // If we're in a popup window, handle the callback and notify parent
            if (window.opener && window.opener !== window) {
              try {
                // Validate state parameter before processing
                const storedState = localStorage.getItem('linkedin_oauth_state');
                if (state !== storedState) {
                  throw new Error('OAuth state validation failed - possible CSRF attack or stale request');
                }
                
                await linkedInService.handleCallback(code, state);
                // Notify parent window of success
                window.opener.postMessage({
                  type: 'LINKEDIN_AUTH_SUCCESS'
                }, '*'); // Use wildcard for cross-port communication
                // Add a small delay before closing to ensure message is sent
                setTimeout(() => window.close(), 100);
              } catch (error) {
                console.error('LinkedIn OAuth callback error:', error);
                // Notify parent window of error
                window.opener.postMessage({
                  type: 'LINKEDIN_AUTH_ERROR',
                  error: error instanceof Error ? error.message : 'Authentication failed'
                }, '*');
                setTimeout(() => window.close(), 100);
              }
            }
          } catch (importError) {
            console.error('LinkedIn service import error:', importError);
            if (window.opener && window.opener !== window) {
              window.opener.postMessage({
                type: 'LINKEDIN_AUTH_ERROR',
                error: 'Failed to load LinkedIn service'
              }, '*');
              setTimeout(() => window.close(), 100);
            }
          }
        } else if (error && window.opener && window.opener !== window) {
          // Handle OAuth error in popup
          window.opener.postMessage({
            type: 'LINKEDIN_AUTH_ERROR',
            error: error
          }, '*');
          setTimeout(() => window.close(), 100);
        }
      } catch (generalError) {
        console.error('LinkedIn callback handler error:', generalError);
        // If we're in a popup, try to notify parent of the error
        if (window.opener && window.opener !== window) {
          try {
            window.opener.postMessage({
              type: 'LINKEDIN_AUTH_ERROR',
              error: 'Callback handler encountered an error'
            }, '*');
            setTimeout(() => window.close(), 100);
          } catch (messageError) {
            console.error('Failed to send error message to parent:', messageError);
            window.close();
          }
        }
      }
    };

    handleLinkedInCallback();
  }, []);

  const handleAddApplication = (newApp: Omit<JobApplication, 'id'>) => {
    const application: JobApplication = {
      ...newApp,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    };

    setApplications((currentApps) => {
      // Check for duplicates based on company and position
      const isDuplicate = currentApps.some(
        app => app.company.toLowerCase() === application.company.toLowerCase() && 
               app.position.toLowerCase() === application.position.toLowerCase()
      );

      if (isDuplicate) {
        toast.error(`Application for ${application.position} at ${application.company} already exists!`);
        return currentApps;
      }

      return [...currentApps, application];
    });
  };

  const getStatusCounts = () => {
    const counts = {
      total: applications.length,
      applied: 0,
      interview: 0,
      offer: 0,
      rejected: 0,
    };

    applications.forEach(app => {
      if (app.status === 'applied') counts.applied++;
      else if (app.status === 'interview') counts.interview++;
      else if (app.status === 'offer') counts.offer++;
      else if (app.status === 'rejected') counts.rejected++;
    });

    return counts;
  };

  const stats = getStatusCounts();
  const activeApplications = stats.applied + stats.interview;

  // Handle statistics card navigation
  const handleStatClick = (filterType: 'all' | 'active' | 'interview' | 'offer') => {
    setActiveTab('applications');
    
    switch (filterType) {
      case 'all':
        setStatusFilters(['applied', 'interview', 'offer', 'rejected', 'withdrawn']);
        break;
      case 'active':
        setStatusFilters(['applied', 'interview']);
        break;
      case 'interview':
        setStatusFilters(['interview']);
        break;
      case 'offer':
        setStatusFilters(['offer']);
        break;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <header className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary text-primary-foreground rounded-lg">
                <Briefcase size={24} />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Job Application Tracker</h1>
                <p className="text-muted-foreground">
                  Manage your job applications with AI email parsing and status tracking
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <UserProfile />
              <ThemeToggle />
            </div>
          </div>

          {applications.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div 
                className="bg-card/80 dark:bg-slate-800/80 backdrop-blur-sm p-4 rounded-lg border cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => handleStatClick('all')}
              >
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-secondary text-secondary-foreground rounded">
                    <Briefcase size={16} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Applications</p>
                    <p className="text-2xl font-bold">{stats.total}</p>
                  </div>
                </div>
              </div>

              <div 
                className="bg-card/80 dark:bg-slate-800/80 backdrop-blur-sm p-4 rounded-lg border cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => handleStatClick('active')}
              >
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-primary text-primary-foreground rounded">
                    <TrendUp size={16} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Active</p>
                    <p className="text-2xl font-bold">{activeApplications}</p>
                  </div>
                </div>
              </div>

              <div 
                className="bg-card/80 dark:bg-slate-800/80 backdrop-blur-sm p-4 rounded-lg border cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => handleStatClick('interview')}
              >
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-accent text-accent-foreground rounded">
                    <span className="text-sm font-bold">📋</span>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Interviews</p>
                    <p className="text-2xl font-bold">{stats.interview}</p>
                  </div>
                </div>
              </div>

              <div 
                className="bg-card/80 dark:bg-slate-800/80 backdrop-blur-sm p-4 rounded-lg border cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => handleStatClick('offer')}
              >
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-accent text-accent-foreground rounded">
                    <span className="text-sm font-bold">🎉</span>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Offers</p>
                    <p className="text-2xl font-bold">{stats.offer}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </header>

        <main>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="applications" className="gap-2">
                <Briefcase size={16} />
                Applications
                {applications.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {applications.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="gmail-setup" className="gap-2">
                <Envelope size={16} />
                Gmail Setup
              </TabsTrigger>
              <TabsTrigger value="linkedin-setup" className="gap-2">
                <LinkedinLogo size={16} />
                LinkedIn Setup
              </TabsTrigger>
              <TabsTrigger value="sync-status" className="gap-2">
                <TrendUp size={16} />
                Sync Status
              </TabsTrigger>
              <TabsTrigger value="review-queue" className="gap-2">
                <Gear size={16} />
                Review Queue
                {reviewQueueCount > 0 && (
                  <Badge variant="destructive" className="ml-1 text-xs">
                    {reviewQueueCount}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="applications" className="space-y-4">
              <ApplicationList 
                applications={applications} 
                onApplicationsChange={setApplications}
                externalStatusFilters={statusFilters}
                onStatusFiltersChange={setStatusFilters}
              />
            </TabsContent>

            <TabsContent value="gmail-setup" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <GmailAuth />
                <div className="space-y-4">
                  <GmailSyncStatus onApplicationAdd={handleAddApplication} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="linkedin-setup" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <LinkedInAuth />
                <div className="space-y-4">
                  <LinkedInSyncStatus 
                    applications={applications} 
                    onApplicationsChange={setApplications} 
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="sync-status" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <GmailSyncStatus onApplicationAdd={handleAddApplication} />
                <LinkedInSyncStatus 
                  applications={applications} 
                  onApplicationsChange={setApplications} 
                />
              </div>
            </TabsContent>

            <TabsContent value="review-queue" className="space-y-4">
              <EmailReviewQueue 
                onApplicationAdd={handleAddApplication}
                onQueueChange={() => {
                  // Update review queue count immediately when queue changes
                  const queue = syncScheduler.getReviewQueue();
                  setReviewQueueCount(queue.length);
                }}
              />
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
}
