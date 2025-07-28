import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { JobApplication } from '@/lib/types';
import { statusLabels, statusColors } from '@/lib/applications';
import { Pencil, Trash2, ExternalLink, Calendar, MapPin, DollarSign, Mail } from '@phosphor-icons/react';
import { format } from 'date-fns';

interface ApplicationCardProps {
  application: JobApplication;
  onEdit: (application: JobApplication) => void;
  onDelete: (id: string) => void;
}

export function ApplicationCard({ application, onEdit, onDelete }: ApplicationCardProps) {
  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete the application for ${application.position} at ${application.company}?`)) {
      onDelete(application.id);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM dd, yyyy');
    } catch {
      return dateString;
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h3 className="font-semibold text-lg leading-tight">{application.position}</h3>
            <p className="text-muted-foreground font-medium">{application.company}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={statusColors[application.status]}>
              {statusLabels[application.status]}
            </Badge>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(application)}
                className="h-8 w-8 p-0"
              >
                <Pencil size={14} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
              >
                <Trash2 size={14} />
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar size={14} />
          <span>Applied {formatDate(application.appliedDate)}</span>
        </div>

        {application.location && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin size={14} />
            <span>{application.location}</span>
          </div>
        )}

        {application.salary && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <DollarSign size={14} />
            <span>{application.salary}</span>
          </div>
        )}

        {application.notes && (
          <div className="text-sm">
            <p className="line-clamp-3">{application.notes}</p>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          {application.jobUrl && (
            <Button
              variant="outline"
              size="sm"
              asChild
              className="gap-2"
            >
              <a href={application.jobUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink size={14} />
                View Job
              </a>
            </Button>
          )}

          {application.contactEmail && (
            <Button
              variant="outline"
              size="sm"
              asChild
              className="gap-2"
            >
              <a href={`mailto:${application.contactEmail}`}>
                <Mail size={14} />
                Contact
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}