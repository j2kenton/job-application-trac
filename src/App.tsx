import { ApplicationList } from './components/ApplicationList';
import { EmailForwardingSetup } from './components/EmailForwardingSetup';
import { GmailAuth } from './components/GmailAuth';
import { GmailSyncStatus } from './components/GmailSyncStatus';
import { EmailReviewQueue } from './components/EmailReviewQueue';
import { JobApplication } from './lib/types';
import { Briefcase, TrendUp, Gear, Envelope } from '@phosphor-icons/react';
import { useState, useEffect } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

function App() {
  const [applications, setApplications] = useState<JobApplication[]>(() => {
    try {
      const saved = localStorage.getItem('job-applications');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('job-applications', JSON.stringify(applications));
  }, [applications]);

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

  return (
    <div className="min-h-screen bg-background">
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
            <EmailForwardingSetup onApplicationAdd={handleAddApplication}>
              <Button variant="outline" size="sm" className="gap-2">
                <Gear size={16} />
                Email Parser
              </Button>
            </EmailForwardingSetup>
          </div>

          {applications.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-card p-4 rounded-lg border">
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

              <div className="bg-card p-4 rounded-lg border">
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

              <div className="bg-card p-4 rounded-lg border">
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

              <div className="bg-card p-4 rounded-lg border">
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
          <Tabs defaultValue="applications" className="space-y-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="applications" className="gap-2">
                <Briefcase size={16} />
                Applications
              </TabsTrigger>
              <TabsTrigger value="gmail-setup" className="gap-2">
                <Envelope size={16} />
                Gmail Setup
              </TabsTrigger>
              <TabsTrigger value="sync-status" className="gap-2">
                <TrendUp size={16} />
                Sync Status
              </TabsTrigger>
              <TabsTrigger value="review-queue" className="gap-2">
                <Gear size={16} />
                Review Queue
              </TabsTrigger>
            </TabsList>

            <TabsContent value="applications" className="space-y-4">
              <ApplicationList 
                applications={applications} 
                onApplicationsChange={setApplications}
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

            <TabsContent value="sync-status" className="space-y-4">
              <GmailSyncStatus onApplicationAdd={handleAddApplication} />
            </TabsContent>

            <TabsContent value="review-queue" className="space-y-4">
              <EmailReviewQueue onApplicationAdd={handleAddApplication} />
            </TabsContent>
          </Tabs>
        </main>
      </div>
      
      <Toaster position="bottom-right" />
    </div>
  );
}

export default App
