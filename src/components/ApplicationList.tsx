import { useState } from 'react';
import { ApplicationCard } from './ApplicationCard';
import { ApplicationForm } from './ApplicationForm';
import { EmailParserDialog } from './EmailParserDialog';
import { EmailForwardingSetup } from './EmailForwardingSetup';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { JobApplication, ApplicationStatus, ParsedEmailData } from '@/lib/types';
import { sortByDate, statusLabels, findDuplicate, createApplication, updateApplication } from '@/lib/applications';
import { syncScheduler } from '@/lib/gmail/SyncScheduler';
import { Plus, Funnel, Briefcase, CaretDown } from '@phosphor-icons/react';
import { toast } from 'sonner';

interface ApplicationListProps {
  applications: JobApplication[];
  onApplicationsChange: (applications: JobApplication[]) => void;
  externalStatusFilters?: ApplicationStatus[];
  onStatusFiltersChange?: (filters: ApplicationStatus[]) => void;
}

export function ApplicationList({ 
  applications, 
  onApplicationsChange, 
  externalStatusFilters,
  onStatusFiltersChange 
}: ApplicationListProps) {
  const [internalStatusFilters, setInternalStatusFilters] = useState<ApplicationStatus[]>([]);
  
  // Use external filters if provided, otherwise use internal
  const statusFilters = externalStatusFilters || internalStatusFilters;
  const setStatusFilters = onStatusFiltersChange || setInternalStatusFilters;
  const [showForm, setShowForm] = useState(false);
  const [editingApplication, setEditingApplication] = useState<JobApplication | null>(null);

  const filteredApplications = sortByDate(
    statusFilters.length === 0 
      ? applications 
      : applications.filter(app => statusFilters.includes(app.status))
  );

  const handleAddApplication = (data: Partial<JobApplication>) => {
    if (!data.company?.trim() || !data.position?.trim()) {
      toast.error('Company and position are required');
      return;
    }

    const duplicate = findDuplicate(applications, data.company, data.position);
    if (duplicate) {
      const shouldContinue = window.confirm(
        `An application for ${data.position} at ${data.company} already exists. Add anyway?`
      );
      if (!shouldContinue) return;
    }

    const newApplication = createApplication(data);
    onApplicationsChange([...applications, newApplication]);
    toast.success('Application added successfully');
  };

  const handleUpdateApplication = (data: Partial<JobApplication>) => {
    if (!editingApplication) return;

    const updatedApplication = updateApplication(editingApplication, data);
    const updatedApplications = applications.map(app =>
      app.id === editingApplication.id ? updatedApplication : app
    );
    
    onApplicationsChange(updatedApplications);
    setEditingApplication(null);
    toast.success('Application updated successfully');
  };

  const handleDeleteApplication = (id: string) => {
    const updatedApplications = applications.filter(app => app.id !== id);
    onApplicationsChange(updatedApplications);
    toast.success('Application deleted');
  };

  const handleEmailParsed = (data: ParsedEmailData) => {
    const applicationData: Partial<JobApplication> = {
      company: data.company,
      position: data.position,
      appliedDate: data.appliedDate || new Date().toISOString().split('T')[0],
      contactEmail: data.contactEmail,
      jobUrl: data.jobUrl,
      notes: `Parsed from email:\n\n${data.rawContent.substring(0, 500)}${data.rawContent.length > 500 ? '...' : ''}`,
    };

    handleAddApplication(applicationData);
  };

  const handleClearAllApplications = () => {
    if (window.confirm(`Are you sure you want to delete all ${applications.length} applications? This will also clear Gmail sync records and review queue. This action cannot be undone.`)) {
      // Clear applications
      onApplicationsChange([]);
      
      // Clear Gmail sync data (review queue, sync history, etc.)
      syncScheduler.clearAllSyncData();
      
      toast.success('All applications and Gmail sync records cleared');
    }
  };

  const getStatusCounts = () => {
    const counts: Record<ApplicationStatus | 'all', number> = {
      all: applications.length,
      applied: 0,
      interview: 0,
      offer: 0,
      rejected: 0,
      withdrawn: 0,
    };

    applications.forEach(app => {
      counts[app.status]++;
    });

    return counts;
  };

  const statusCounts = getStatusCounts();

  const handleStatusToggle = (status: ApplicationStatus, checked: boolean) => {
    if (checked) {
      setStatusFilters([...statusFilters, status]);
    } else {
      setStatusFilters(statusFilters.filter(s => s !== status));
    }
  };

  const handleSelectAll = () => {
    setStatusFilters(['applied', 'interview', 'offer', 'rejected', 'withdrawn']);
  };

  const handleClearFilters = () => {
    setStatusFilters([]);
  };

  const getFilterDisplayText = () => {
    if (statusFilters.length === 0) {
      return 'All Applications';
    }
    if (statusFilters.length === 1) {
      return statusLabels[statusFilters[0]];
    }
    return `${statusFilters.length} statuses selected`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2">
          <Funnel size={20} />
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-48 justify-between">
                {getFilterDisplayText()}
                <CaretDown size={16} />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="font-medium text-sm">Filter by Status</h4>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSelectAll}
                      className="h-6 px-2 text-xs"
                    >
                      All
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearFilters}
                      className="h-6 px-2 text-xs"
                    >
                      Clear
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  {Object.entries(statusLabels).map(([status, label]) => (
                    <div key={status} className="flex items-center space-x-2">
                      <Checkbox
                        id={status}
                        checked={statusFilters.includes(status as ApplicationStatus)}
                        onCheckedChange={(checked) =>
                          handleStatusToggle(status as ApplicationStatus, checked as boolean)
                        }
                      />
                      <label
                        htmlFor={status}
                        className="text-sm cursor-pointer flex-1 flex justify-between"
                      >
                        <span>{label}</span>
                        <span className="text-muted-foreground">
                          ({statusCounts[status as ApplicationStatus]})
                        </span>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex gap-2">
          <EmailForwardingSetup />
          <EmailParserDialog onParsed={handleEmailParsed} />
          <Button onClick={() => setShowForm(true)} className="gap-2">
            <Plus size={16} />
            Add Application
          </Button>
          {applications.length > 0 && (
            <Button 
              variant="outline" 
              onClick={handleClearAllApplications}
              className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              Clear All
            </Button>
          )}
        </div>
      </div>

      {filteredApplications.length === 0 ? (
        <div className="text-center py-12">
          <div className="flex flex-col items-center gap-4">
            <div className="p-4 bg-muted rounded-full">
              <Briefcase size={32} className="text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">
                {statusFilters.length === 0 
                  ? 'No applications yet' 
                  : 'No applications match the selected filters'
                }
              </h3>
              <p className="text-muted-foreground max-w-md">
                {statusFilters.length === 0
                  ? 'Get started by adding your first job application or parsing an email.'
                  : 'Try adjusting your filters to see more applications.'
                }
              </p>
            </div>
            {statusFilters.length === 0 && (
              <div className="flex gap-2">
                <EmailForwardingSetup>
                  <Button variant="outline" className="gap-2">
                    Email Setup
                  </Button>
                </EmailForwardingSetup>
                <EmailParserDialog onParsed={handleEmailParsed}>
                  <Button variant="outline" className="gap-2">
                    Parse Email
                  </Button>
                </EmailParserDialog>
                <Button onClick={() => setShowForm(true)} className="gap-2">
                  <Plus size={16} />
                  Add Application
                </Button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredApplications.map((application) => (
            <ApplicationCard
              key={application.id}
              application={application}
              onEdit={setEditingApplication}
              onDelete={handleDeleteApplication}
            />
          ))}
        </div>
      )}

      <ApplicationForm
        open={showForm}
        onOpenChange={setShowForm}
        onSubmit={handleAddApplication}
        mode="create"
      />

      <ApplicationForm
        open={!!editingApplication}
        onOpenChange={(open) => !open && setEditingApplication(null)}
        onSubmit={handleUpdateApplication}
        initialData={editingApplication || undefined}
        mode="edit"
      />
    </div>
  );
}
