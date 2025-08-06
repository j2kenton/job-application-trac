export type ApplicationStatus = 
  | 'applied' 
  | 'interview' 
  | 'offer' 
  | 'rejected' 
  | 'withdrawn';

export interface JobApplication {
  id: string;
  company: string;
  position: string;
  status: ApplicationStatus;
  appliedDate: string;
  notes?: string;
  contactEmail?: string;
  recruiter?: string;
  interviewer?: string;
  jobUrl?: string;
  salary?: string;
  location?: string;
  emailContent?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ParsedEmailData {
  company?: string;
  position?: string;
  appliedDate?: string;
  contactEmail?: string;
  jobUrl?: string;
  rawContent: string;
}
