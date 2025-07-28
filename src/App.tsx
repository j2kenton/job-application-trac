import { ApplicationList } from './components/ApplicationList';
import { JobApplication } from './lib/types';
import { Briefcase, TrendingUp } from '@phosphor-icons/react';
import { useKV } from '@github/spark/hooks';
import { Toaster } from '@/components/ui/sonner';

function App() {
  const [applications, setApplications] = useKV<JobApplication[]>('job-applications', []);

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
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-primary text-primary-foreground rounded-lg">
              <Briefcase size={24} />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Job Application Tracker</h1>
              <p className="text-muted-foreground">
                Manage your job applications with email parsing and status tracking
              </p>
            </div>
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
                    <TrendingUp size={16} />
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
          <ApplicationList 
            applications={applications} 
            onApplicationsChange={setApplications}
          />
        </main>
      </div>
      
      <Toaster position="bottom-right" />
    </div>
  );
}

export default App