import { JobApplication, ApplicationStatus } from './types';

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export function createApplication(data: Partial<JobApplication>): JobApplication {
  const now = new Date().toISOString();
  
  return {
    id: generateId(),
    company: data.company || '',
    position: data.position || '',
    status: data.status || 'applied',
    appliedDate: data.appliedDate || new Date().toISOString().split('T')[0],
    notes: data.notes || '',
    contactEmail: data.contactEmail || '',
    jobUrl: data.jobUrl || '',
    salary: data.salary || '',
    location: data.location || '',
    createdAt: now,
    updatedAt: now,
  };
}

export function updateApplication(existing: JobApplication, updates: Partial<JobApplication>): JobApplication {
  return {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
}

export function findDuplicate(applications: JobApplication[], company: string, position: string): JobApplication | undefined {
  return applications.find(app => 
    app.company.toLowerCase().trim() === company.toLowerCase().trim() &&
    app.position.toLowerCase().trim() === position.toLowerCase().trim()
  );
}

export function filterByStatus(applications: JobApplication[], status?: ApplicationStatus): JobApplication[] {
  if (!status) return applications;
  return applications.filter(app => app.status === status);
}

export function sortByDate(applications: JobApplication[], direction: 'asc' | 'desc' = 'desc'): JobApplication[] {
  return [...applications].sort((a, b) => {
    const dateA = new Date(a.appliedDate).getTime();
    const dateB = new Date(b.appliedDate).getTime();
    return direction === 'desc' ? dateB - dateA : dateA - dateB;
  });
}

export const statusLabels: Record<ApplicationStatus, string> = {
  applied: 'Applied',
  interview: 'Interview',
  offer: 'Offer',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
};

export const statusColors: Record<ApplicationStatus, string> = {
  applied: 'bg-secondary text-secondary-foreground',
  interview: 'bg-primary text-primary-foreground',
  offer: 'bg-accent text-accent-foreground',
  rejected: 'bg-destructive text-destructive-foreground',
  withdrawn: 'bg-muted text-muted-foreground',
};