import { useState } from 'react';
import { ApplicationCard } from './ApplicationCard';
import { ApplicationForm } from './ApplicationForm';
import { EmailParserDialog } from './EmailParserDialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { JobApplication, ApplicationStatus, ParsedEmailData } from '@/lib/types';
import { filterByStatus, sortByDate, statusLabels, findDuplicate, createApplication, updateApplication } from '@/lib/applications';
import { Plus, Filter, Briefcase } from '@phosphor-icons/react';
import { toast } from 'sonner';

interface ApplicationListProps {
  applications: JobApplication[];
  onApplicationsChange: (applications: JobApplication[]) => void;
}

export function ApplicationList({ applications, onApplicationsChange }: ApplicationListProps) {
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | 'all'>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingApplication, setEditingApplication] = useState<JobApplication | null>(null);

  const filteredApplications = sortByDate(
    statusFilter === 'all' ? applications : filterByStatus(applications, statusFilter)
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter size={20} />
          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as ApplicationStatus | 'all')}
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                All Applications ({statusCounts.all})
              </SelectItem>
              {Object.entries(statusLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label} ({statusCounts[value as ApplicationStatus]})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2">
          <EmailParserDialog onParsed={handleEmailParsed} />
          <Button onClick={() => setShowForm(true)} className="gap-2">
            <Plus size={16} />
            Add Application
          </Button>
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
                {statusFilter === 'all' 
                  ? 'No applications yet' 
                  : `No ${statusLabels[statusFilter as ApplicationStatus].toLowerCase()} applications`
                }
              </h3>
              <p className="text-muted-foreground max-w-md">
                {statusFilter === 'all'
                  ? 'Get started by adding your first job application or parsing an email.'
                  : 'Try adjusting your filter to see more applications.'
                }
              </p>
            </div>
            {statusFilter === 'all' && (
              <div className="flex gap-2">
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