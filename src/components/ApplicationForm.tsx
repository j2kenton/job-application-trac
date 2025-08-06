import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { JobApplication, ApplicationStatus } from '@/lib/types';
import { statusLabels } from '@/lib/applications';

interface ApplicationFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (application: Partial<JobApplication>) => void;
  initialData?: Partial<JobApplication>;
  mode: 'create' | 'edit';
}

export function ApplicationForm({ open, onOpenChange, onSubmit, initialData, mode }: ApplicationFormProps) {
  const [formData, setFormData] = useState<Partial<JobApplication>>({
    company: '',
    position: '',
    status: 'applied',
    appliedDate: new Date().toISOString().split('T')[0],
    notes: '',
    contactEmail: '',
    jobUrl: '',
    salary: '',
    location: '',
    emailContent: '',
  });

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    }
  }, [initialData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    onSubmit(formData);
    
    if (mode === 'create') {
      setFormData({
        company: '',
        position: '',
        status: 'applied',
        appliedDate: new Date().toISOString().split('T')[0],
        notes: '',
        contactEmail: '',
        jobUrl: '',
        salary: '',
        location: '',
        emailContent: '',
      });
    }
    
    onOpenChange(false);
  };

  const updateField = (field: keyof JobApplication, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Add New Application' : 'Edit Application'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="company">Company</Label>
              <Input
                id="company"
                value={formData.company || ''}
                onChange={(e) => updateField('company', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="position">Position</Label>
              <Input
                id="position"
                value={formData.position || ''}
                onChange={(e) => updateField('position', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select 
                value={formData.status} 
                onValueChange={(value) => updateField('status', value as ApplicationStatus)}
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="applied-date">Applied Date</Label>
              <Input
                id="applied-date"
                type="date"
                value={formData.appliedDate || ''}
                onChange={(e) => updateField('appliedDate', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={formData.location || ''}
                onChange={(e) => updateField('location', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="salary">Salary</Label>
              <Input
                id="salary"
                value={formData.salary || ''}
                onChange={(e) => updateField('salary', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact-email">Contact Email</Label>
              <Input
                id="contact-email"
                type="email"
                value={formData.contactEmail || ''}
                onChange={(e) => updateField('contactEmail', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="job-url">Job URL</Label>
              <Input
                id="job-url"
                type="url"
                value={formData.jobUrl || ''}
                onChange={(e) => updateField('jobUrl', e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes || ''}
              onChange={(e) => updateField('notes', e.target.value)}
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email-content">Email Content</Label>
            <Textarea
              id="email-content"
              value={formData.emailContent || ''}
              onChange={(e) => updateField('emailContent', e.target.value)}
              rows={8}
              className="resize-vertical"
            />
          </div>

          <div className="flex gap-2">
            <Button type="submit" className="flex-1">
              {mode === 'create' ? 'Add Application' : 'Update Application'}
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
