import { JobApplication, ApplicationStatus } from './types';
import { applicationMerger, MergedApplicationData } from './application-merger';
import { gmailService, ProcessedEmail } from './gmail/GmailService';

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
    recruiter: data.recruiter || '',
    interviewer: data.interviewer || '',
    jobUrl: data.jobUrl || '',
    salary: data.salary || '',
    location: data.location || '',
    emailContent: data.emailContent || '',
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

/**
 * Creates or updates an application with smart data merging from multiple emails
 */
export async function createOrUpdateApplicationWithMerging(
  applicationData: Partial<JobApplication>,
  relatedEmails: ProcessedEmail[],
  existingApplications: JobApplication[]
): Promise<{
  application: JobApplication;
  isUpdate: boolean;
  mergeInfo: {
    emailCount: number;
    dataSourceSummary: Record<string, string>;
    statusHistory: Array<{
      status: ApplicationStatus;
      date: string;
      emailId: string;
      confidence: number;
    }>;
  };
}> {
  
  // Check if this is a duplicate application
  const existingApp = findDuplicate(
    existingApplications,
    applicationData.company || '',
    applicationData.position || ''
  );

  let emailsToMerge = relatedEmails;

  // If updating existing application, fetch additional related emails
  if (existingApp && (applicationData.company || applicationData.position)) {
    try {
      console.log('Fetching additional related emails for existing application...');
      const additionalEmails = await gmailService.fetchRelatedApplicationEmails(
        existingApp.company,
        existingApp.position,
        90 // Look back 90 days
      );

      // Process additional emails
      const processedAdditionalEmails = await Promise.all(
        additionalEmails.map(email => gmailService.processEmail(email))
      );

      // Combine and deduplicate emails
      const allEmails = [...relatedEmails];
      const existingIds = new Set(relatedEmails.map(e => e.id));
      
      processedAdditionalEmails.forEach(email => {
        if (!existingIds.has(email.id)) {
          allEmails.push(email);
        }
      });

      emailsToMerge = allEmails;
      console.log(`Found ${allEmails.length} total emails for merging (${relatedEmails.length} new + ${processedAdditionalEmails.length} historical)`);
      
    } catch (error) {
      console.warn('Failed to fetch additional related emails:', error);
      // Continue with just the provided emails
    }
  }

  // Use application merger to combine data from all emails
  const mergedData = await applicationMerger.mergeApplicationData(
    emailsToMerge,
    existingApp
  );

  // Create the final application data
  const finalApplicationData: Partial<JobApplication> = {
    ...applicationData,
    company: mergedData.company || applicationData.company,
    position: mergedData.position || applicationData.position,
    status: mergedData.status,
    appliedDate: mergedData.appliedDate,
    contactEmail: mergedData.contactEmail || applicationData.contactEmail,
    recruiter: mergedData.recruiter || applicationData.recruiter,
    interviewer: mergedData.interviewer || applicationData.interviewer,
    jobUrl: mergedData.jobUrl || applicationData.jobUrl,
    salary: mergedData.salary || applicationData.salary,
    location: mergedData.location || applicationData.location,
    notes: mergedData.notes || applicationData.notes,
  };

  let finalApplication: JobApplication;
  let isUpdate = false;

  if (existingApp) {
    // Update existing application
    finalApplication = updateApplication(existingApp, finalApplicationData);
    isUpdate = true;
    
    console.log('Updated existing application with merged data:', {
      company: finalApplication.company,
      position: finalApplication.position,
      status: finalApplication.status,
      emailCount: emailsToMerge.length
    });
    
  } else {
    // Create new application
    finalApplication = createApplication(finalApplicationData);
    
    console.log('Created new application with merged data:', {
      company: finalApplication.company,
      position: finalApplication.position,
      status: finalApplication.status,
      emailCount: emailsToMerge.length
    });
  }

  return {
    application: finalApplication,
    isUpdate,
    mergeInfo: mergedData.mergeMetadata
  };
}

/**
 * Enhanced duplicate finding with fuzzy matching
 */
export function findDuplicateEnhanced(
  applications: JobApplication[],
  company: string,
  position: string,
  threshold: number = 0.8
): JobApplication | undefined {
  
  const normalizeString = (str: string) =>
    str.toLowerCase()
       .trim()
       .replace(/[^\w\s]/g, '')
       .replace(/\s+/g, ' ');

  const normalizedCompany = normalizeString(company);
  const normalizedPosition = normalizeString(position);

  // First try exact match
  const exactMatch = findDuplicate(applications, company, position);
  if (exactMatch) return exactMatch;

  // Then try fuzzy matching
  for (const app of applications) {
    const appCompany = normalizeString(app.company);
    const appPosition = normalizeString(app.position);

    // Simple word-based similarity
    const companyScore = calculateSimilarity(normalizedCompany, appCompany);
    const positionScore = calculateSimilarity(normalizedPosition, appPosition);
    
    // Both company and position must meet threshold
    if (companyScore >= threshold && positionScore >= threshold) {
      console.log('Found fuzzy duplicate:', {
        existing: { company: app.company, position: app.position },
        new: { company, position },
        scores: { company: companyScore, position: positionScore }
      });
      return app;
    }
  }

  return undefined;
}

/**
 * Simple similarity calculation (Jaccard similarity)
 */
function calculateSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1;
  if (!str1 || !str2) return 0;

  const words1 = new Set(str1.split(' '));
  const words2 = new Set(str2.split(' '));
  
  const intersection = new Set([...words1].filter(word => words2.has(word)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
}

/**
 * Gets application update suggestions based on email content
 */
export async function getApplicationUpdateSuggestions(
  application: JobApplication,
  newEmailContent: ProcessedEmail
): Promise<{
  suggestedUpdates: Partial<JobApplication>;
  confidence: number;
  reasoning: string;
  shouldAutoUpdate: boolean;
}> {
  
  try {
    // Use the merger to analyze just this email against existing application
    const mergedData = await applicationMerger.mergeApplicationData(
      [newEmailContent],
      application
    );

    const suggestedUpdates: Partial<JobApplication> = {};
    let updateReasons: string[] = [];
    let highConfidenceUpdates = 0;

    // Check for status updates
    if (mergedData.status !== application.status) {
      const statusHistory = mergedData.mergeMetadata.statusHistory;
      const latestStatus = statusHistory[0];
      
      if (latestStatus && latestStatus.confidence > 0.7) {
        suggestedUpdates.status = mergedData.status;
        updateReasons.push(`Status change: ${application.status} → ${mergedData.status} (${Math.round(latestStatus.confidence * 100)}% confidence)`);
        highConfidenceUpdates++;
      }
    }

    // Check for new contact information
    if (mergedData.contactEmail && !application.contactEmail) {
      suggestedUpdates.contactEmail = mergedData.contactEmail;
      updateReasons.push('Added contact email');
      highConfidenceUpdates++;
    }

    // Check for salary information
    if (mergedData.salary && !application.salary) {
      suggestedUpdates.salary = mergedData.salary;
      updateReasons.push('Added salary information');
      highConfidenceUpdates++;
    }

    // Check for location updates (especially for interviews)
    if (mergedData.location && mergedData.location !== application.location) {
      suggestedUpdates.location = mergedData.location;
      updateReasons.push('Updated location/meeting info');
      highConfidenceUpdates++;
    }

    // Check for recruiter/interviewer info
    if (mergedData.recruiter && !application.recruiter) {
      suggestedUpdates.recruiter = mergedData.recruiter;
      updateReasons.push('Added recruiter information');
    }

    if (mergedData.interviewer && !application.interviewer) {
      suggestedUpdates.interviewer = mergedData.interviewer;
      updateReasons.push('Added interviewer information');
    }

    // Update notes with new information
    if (mergedData.notes && mergedData.notes !== application.notes) {
      suggestedUpdates.notes = mergedData.notes;
      updateReasons.push('Enhanced notes with email history');
    }

    const confidence = highConfidenceUpdates > 0 ? 0.8 : 0.5;
    const shouldAutoUpdate = highConfidenceUpdates >= 2 && confidence > 0.7;

    return {
      suggestedUpdates,
      confidence,
      reasoning: updateReasons.join('; '),
      shouldAutoUpdate
    };

  } catch (error) {
    console.error('Failed to get application update suggestions:', error);
    return {
      suggestedUpdates: {},
      confidence: 0,
      reasoning: 'Failed to analyze email content',
      shouldAutoUpdate: false
    };
  }
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
