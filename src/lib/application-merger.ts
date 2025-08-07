import { ProcessedEmail } from './gmail/GmailService';
import { JobApplication, ApplicationStatus } from './types';
import { aiStatusDetector } from './ai-status-detector';
import { parseEmailWithStatusDetection, detectStatusFromEmail } from './emailParser';

export interface MergedApplicationData {
  company: string;
  position: string;
  status: ApplicationStatus;
  appliedDate: string;
  contactEmail?: string;
  jobUrl?: string;
  salary?: string;
  location?: string;
  notes?: string;
  recruiter?: string;
  interviewer?: string;
  mergeMetadata: {
    emailCount: number;
    dataSourceSummary: Record<string, string>; // field -> source email info
    statusHistory: Array<{
      status: ApplicationStatus;
      date: string;
      emailId: string;
      confidence: number;
    }>;
  };
}

export interface FieldExtractionResult {
  value: string;
  confidence: number;
  sourceEmailId: string;
  sourceDate: string;
  extractionMethod: 'rule-based' | 'ai-enhanced' | 'manual';
}

class ApplicationMerger {
  /**
   * Merges data from multiple emails for the same job application
   */
  async mergeApplicationData(
    emails: ProcessedEmail[],
    existingApplication?: JobApplication
  ): Promise<MergedApplicationData> {
    
    if (emails.length === 0) {
      throw new Error('No emails provided for merging');
    }

    // Sort emails by date (newest first for status, oldest first for application data)
    const sortedByDate = [...emails].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    
    const oldestFirst = [...emails].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    console.log('Merging application data from', emails.length, 'emails');

    // Merge core application fields
    const mergedData: MergedApplicationData = {
      company: '',
      position: '',
      status: 'applied',
      appliedDate: '',
      mergeMetadata: {
        emailCount: emails.length,
        dataSourceSummary: {},
        statusHistory: []
      }
    };

    // 1. Determine current status from most recent email
    const statusResult = await this.determineCurrentStatus(sortedByDate, existingApplication?.status);
    mergedData.status = statusResult.status;
    mergedData.mergeMetadata.statusHistory = statusResult.history;

    // 2. Extract core identity fields (company, position) - prefer oldest/most confident
    const companyResult = this.findBestFieldValue(emails, 'company');
    const positionResult = this.findBestFieldValue(emails, 'position');
    
    mergedData.company = companyResult.value;
    mergedData.position = positionResult.value;
    mergedData.mergeMetadata.dataSourceSummary['company'] = this.formatSourceInfo(companyResult);
    mergedData.mergeMetadata.dataSourceSummary['position'] = this.formatSourceInfo(positionResult);

    // 3. Applied date - use oldest email that mentions application
    const appliedDateResult = this.findAppliedDate(oldestFirst);
    mergedData.appliedDate = appliedDateResult.value;
    mergedData.mergeMetadata.dataSourceSummary['appliedDate'] = this.formatSourceInfo(appliedDateResult);

    // 4. Contact information - use any email that has it (prefer non-noreply)
    const contactEmailResult = this.findBestContactEmail(emails);
    if (contactEmailResult) {
      mergedData.contactEmail = contactEmailResult.value;
      mergedData.mergeMetadata.dataSourceSummary['contactEmail'] = this.formatSourceInfo(contactEmailResult);
    }

    // 5. Job URL - prefer from original application email
    const jobUrlResult = this.findJobUrl(oldestFirst);
    if (jobUrlResult) {
      mergedData.jobUrl = jobUrlResult.value;
      mergedData.mergeMetadata.dataSourceSummary['jobUrl'] = this.formatSourceInfo(jobUrlResult);
    }

    // 6. Salary information - use most recent mention
    const salaryResult = this.findBestFieldValue(emails, 'salary');
    if (salaryResult.value) {
      mergedData.salary = salaryResult.value;
      mergedData.mergeMetadata.dataSourceSummary['salary'] = this.formatSourceInfo(salaryResult);
    }

    // 7. Location - context dependent (meeting location from recent, job location from old)
    const locationResult = this.findBestLocation(emails);
    if (locationResult) {
      mergedData.location = locationResult.value;
      mergedData.mergeMetadata.dataSourceSummary['location'] = this.formatSourceInfo(locationResult);
    }

    // 8. Recruiter/Interviewer information
    const recruiterResult = this.findRecruiterInfo(emails);
    if (recruiterResult) {
      mergedData.recruiter = recruiterResult.value;
      mergedData.mergeMetadata.dataSourceSummary['recruiter'] = this.formatSourceInfo(recruiterResult);
    }

    const interviewerResult = this.findInterviewerInfo(emails);
    if (interviewerResult) {
      mergedData.interviewer = interviewerResult.value;
      mergedData.mergeMetadata.dataSourceSummary['interviewer'] = this.formatSourceInfo(interviewerResult);
    }

    // 9. Comprehensive notes from all emails
    mergedData.notes = this.buildComprehensiveNotes(emails, mergedData.mergeMetadata.statusHistory);

    console.log('Application data merged successfully:', {
      company: mergedData.company,
      position: mergedData.position,
      status: mergedData.status,
      emailCount: emails.length,
      sourceSummary: Object.keys(mergedData.mergeMetadata.dataSourceSummary)
    });

    return mergedData;
  }

  /**
   * Determines current application status from email history
   */
  private async determineCurrentStatus(
    emailsSortedByDate: ProcessedEmail[],
    currentStatus?: ApplicationStatus
  ): Promise<{
    status: ApplicationStatus;
    history: Array<{
      status: ApplicationStatus;
      date: string;
      emailId: string;
      confidence: number;
    }>;
  }> {
    
    const statusHistory: Array<{
      status: ApplicationStatus;
      date: string;
      emailId: string;
      confidence: number;
    }> = [];

    let finalStatus: ApplicationStatus = currentStatus || 'applied';
    let highestConfidence = 0;

    // Analyze each email for status indicators
    for (const email of emailsSortedByDate) {
      try {
        const statusAnalysis = await aiStatusDetector.detectApplicationStatus(
          email.subject,
          email.content,
          email.from,
          currentStatus
        );

        statusHistory.push({
          status: statusAnalysis.detectedStatus,
          date: email.date,
          emailId: email.id,
          confidence: statusAnalysis.confidence
        });

        // Use status from most recent high-confidence detection
        if (statusAnalysis.confidence > highestConfidence && 
            statusAnalysis.confidence > 0.7) {
          finalStatus = statusAnalysis.detectedStatus;
          highestConfidence = statusAnalysis.confidence;
        }

      } catch (error) {
        console.warn('Status detection failed for email', email.id, ':', error);
        
        // Fallback to basic pattern matching
        const subject = email.subject.toLowerCase();
        const content = email.content.toLowerCase();
        
        if (content.includes('unfortunately') || content.includes('regret') || 
            content.includes('not selected') || content.includes('decided to go')) {
          statusHistory.push({
            status: 'rejected',
            date: email.date,
            emailId: email.id,
            confidence: 0.6
          });
          if (0.6 > highestConfidence) {
            finalStatus = 'rejected';
            highestConfidence = 0.6;
          }
        } else if (subject.includes('interview') || content.includes('schedule') ||
                   content.includes('zoom') || content.includes('teams')) {
          statusHistory.push({
            status: 'interview',
            date: email.date,
            emailId: email.id,
            confidence: 0.6
          });
          if (0.6 > highestConfidence) {
            finalStatus = 'interview';
            highestConfidence = 0.6;
          }
        }
      }
    }

    // Sort history by date (newest first)
    statusHistory.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return {
      status: finalStatus,
      history: statusHistory
    };
  }

  /**
   * Finds the best value for a specific field across all emails
   */
  private findBestFieldValue(
    emails: ProcessedEmail[],
    fieldName: keyof ProcessedEmail['extractedData']
  ): FieldExtractionResult {
    
    let bestResult: FieldExtractionResult = {
      value: '',
      confidence: 0,
      sourceEmailId: '',
      sourceDate: '',
      extractionMethod: 'rule-based'
    };

    for (const email of emails) {
      const fieldValue = email.extractedData[fieldName];
      
      if (fieldValue && typeof fieldValue === 'string' && fieldValue.trim()) {
        const confidence = email.confidence;
        
        // Prefer higher confidence extractions
        if (confidence > bestResult.confidence) {
          bestResult = {
            value: fieldValue.trim(),
            confidence,
            sourceEmailId: email.id,
            sourceDate: email.date,
            extractionMethod: email.extractedData.notes?.includes('AI') ? 'ai-enhanced' : 'rule-based'
          };
        }
      }
    }

    return bestResult;
  }

  /**
   * Finds the applied date from the oldest relevant email
   */
  private findAppliedDate(emailsOldestFirst: ProcessedEmail[]): FieldExtractionResult {
    // Look for explicit applied date first
    for (const email of emailsOldestFirst) {
      if (email.extractedData.appliedDate) {
        return {
          value: email.extractedData.appliedDate,
          confidence: email.confidence,
          sourceEmailId: email.id,
          sourceDate: email.date,
          extractionMethod: 'rule-based'
        };
      }
    }

    // Fallback to date of oldest email that seems like an application
    const applicationEmail = emailsOldestFirst.find(email => 
      email.content.toLowerCase().includes('application') ||
      email.content.toLowerCase().includes('applied') ||
      email.subject.toLowerCase().includes('application')
    );

    if (applicationEmail) {
      return {
        value: new Date(applicationEmail.date).toISOString().split('T')[0],
        confidence: 0.7,
        sourceEmailId: applicationEmail.id,
        sourceDate: applicationEmail.date,
        extractionMethod: 'rule-based'
      };
    }

    // Ultimate fallback - oldest email date
    const oldestEmail = emailsOldestFirst[0];
    return {
      value: new Date(oldestEmail.date).toISOString().split('T')[0],
      confidence: 0.3,
      sourceEmailId: oldestEmail.id,
      sourceDate: oldestEmail.date,
      extractionMethod: 'rule-based'
    };
  }

  /**
   * Extracts email address from various formats including "Name <email@domain.com>"
   */
  private extractEmailAddress(emailString: string): string | null {
    if (!emailString) return null;

    // Pattern 1: Extract from "Name <email@domain.com>" format
    const angleMatch = emailString.match(/<([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>/);
    if (angleMatch) {
      return angleMatch[1];
    }

    // Pattern 2: Direct email address
    const directMatch = emailString.match(/^([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})$/);
    if (directMatch) {
      return directMatch[1];
    }

    // Pattern 3: Extract any email from string
    const anyMatch = emailString.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (anyMatch) {
      return anyMatch[1];
    }

    return null;
  }

  /**
   * Finds the best contact email (prefer human contacts over noreply)
   */
  private findBestContactEmail(emails: ProcessedEmail[]): FieldExtractionResult | null {
    const candidates: FieldExtractionResult[] = [];

    for (const email of emails) {
      // Check extracted contact email
      if (email.extractedData.contactEmail) {
        const extractedEmail = this.extractEmailAddress(email.extractedData.contactEmail);
        if (extractedEmail) {
          const isNoreply = extractedEmail.toLowerCase().includes('noreply') ||
                           extractedEmail.toLowerCase().includes('no-reply');
          
          candidates.push({
            value: extractedEmail,
            confidence: isNoreply ? 0.3 : 0.8,
            sourceEmailId: email.id,
            sourceDate: email.date,
            extractionMethod: 'rule-based'
          });
        }
      }

      // Also consider sender email if it's not noreply
      const senderEmail = this.extractEmailAddress(email.from);
      if (senderEmail) {
        const isNoreply = senderEmail.toLowerCase().includes('noreply') ||
                         senderEmail.toLowerCase().includes('no-reply') ||
                         senderEmail.toLowerCase().includes('donotreply');
        
        if (!isNoreply) {
          candidates.push({
            value: senderEmail,
            confidence: 0.6,
            sourceEmailId: email.id,
            sourceDate: email.date,
            extractionMethod: 'rule-based'
          });
        }
      }
    }

    // Return highest confidence contact
    if (candidates.length > 0) {
      return candidates.reduce((best, current) => 
        current.confidence > best.confidence ? current : best
      );
    }

    return null;
  }

  /**
   * Finds job URL from original application emails
   */
  private findJobUrl(emailsOldestFirst: ProcessedEmail[]): FieldExtractionResult | null {
    for (const email of emailsOldestFirst) {
      if (email.extractedData.jobUrl) {
        return {
          value: email.extractedData.jobUrl,
          confidence: email.confidence,
          sourceEmailId: email.id,
          sourceDate: email.date,
          extractionMethod: 'rule-based'
        };
      }
    }
    return null;
  }

  /**
   * Finds location information (context-dependent)
   */
  private findBestLocation(emails: ProcessedEmail[]): FieldExtractionResult | null {
    const candidates: FieldExtractionResult[] = [];

    for (const email of emails) {
      if (email.extractedData.location) {
        // Check if it's a meeting URL or physical address
        const isVirtualMeeting = email.extractedData.location.includes('zoom') ||
                                email.extractedData.location.includes('teams') ||
                                email.extractedData.location.includes('meet.google') ||
                                email.extractedData.location.includes('http');

        candidates.push({
          value: email.extractedData.location,
          confidence: isVirtualMeeting ? 0.9 : 0.7, // Virtual meetings are more precise
          sourceEmailId: email.id,
          sourceDate: email.date,
          extractionMethod: 'rule-based'
        });
      }
    }

    // Return most recent high-confidence location (for interviews) or best general location
    if (candidates.length > 0) {
      // Sort by date (newest first) and then by confidence
      candidates.sort((a, b) => {
        const dateA = new Date(a.sourceDate).getTime();
        const dateB = new Date(b.sourceDate).getTime();
        if (Math.abs(dateA - dateB) < 24 * 60 * 60 * 1000) { // Within 1 day
          return b.confidence - a.confidence;
        }
        return dateB - dateA;
      });

      return candidates[0];
    }

    return null;
  }

  /**
   * Extracts name from email address format "Name <email@domain.com>"
   */
  private extractNameFromEmailFormat(emailString: string): string | null {
    if (!emailString) return null;

    // Pattern: Extract name from "Name <email@domain.com>" format
    const nameMatch = emailString.match(/^([^<]+)</);
    if (nameMatch) {
      const name = nameMatch[1].trim();
      
      // Filter out non-human names and LinkedIn
      if (!name.toLowerCase().includes('linkedin') &&
          !name.toLowerCase().includes('noreply') &&
          !name.toLowerCase().includes('no-reply') &&
          !name.toLowerCase().includes('donotreply') &&
          !name.toLowerCase().includes('support') &&
          !name.toLowerCase().includes('team') &&
          !name.toLowerCase().includes('notifications') &&
          name.length > 2 && 
          name.length < 100) {
        return name;
      }
    }

    return null;
  }

  /**
   * Extracts recruiter information from emails
   */
  private findRecruiterInfo(emails: ProcessedEmail[]): FieldExtractionResult | null {
    const candidates: FieldExtractionResult[] = [];

    for (const email of emails) {
      const content = email.content.toLowerCase();
      const from = email.from.toLowerCase();
      const subject = email.subject?.toLowerCase() || '';

      // Priority 1: Use already extracted recruiter from content parsing
      if (email.extractedData.recruiter) {
        candidates.push({
          value: email.extractedData.recruiter,
          confidence: 0.9,
          sourceEmailId: email.id,
          sourceDate: email.date,
          extractionMethod: 'rule-based'
        });
        continue;
      }

      // Priority 2: Look for recruiter indicators in role/content
      const isRecruiterEmail = from.includes('recruit') || 
                              content.includes('recruiter') || 
                              content.includes('talent acquisition') || 
                              content.includes('hr') ||
                              subject.includes('recruit');
      
      if (isRecruiterEmail) {
        const nameFromEmail = this.extractNameFromEmailFormat(email.from);
        if (nameFromEmail) {
          candidates.push({
            value: nameFromEmail,
            confidence: 0.8,
            sourceEmailId: email.id,
            sourceDate: email.date,
            extractionMethod: 'rule-based'
          });
          continue;
        }
      }

      // Priority 3: General human contact from any job-related email
      const isJobRelatedEmail = content.includes('application') ||
                               content.includes('interview') ||
                               content.includes('position') ||
                               content.includes('opportunity') ||
                               subject.includes('application') ||
                               subject.includes('interview');

      if (isJobRelatedEmail) {
        const nameFromEmail = this.extractNameFromEmailFormat(email.from);
        if (nameFromEmail) {
          candidates.push({
            value: nameFromEmail,
            confidence: 0.6,
            sourceEmailId: email.id,
            sourceDate: email.date,
            extractionMethod: 'rule-based'
          });
        }
      }
    }

    // Return highest confidence recruiter
    if (candidates.length > 0) {
      return candidates.reduce((best, current) => 
        current.confidence > best.confidence ? current : best
      );
    }

    return null;
  }

  /**
   * Extracts interviewer information
   */
  private findInterviewerInfo(emails: ProcessedEmail[]): FieldExtractionResult | null {
    for (const email of emails) {
      const content = email.content.toLowerCase();
      const subject = email.subject.toLowerCase();

      if (subject.includes('interview') || content.includes('interview')) {
        // Extract name from email signature or from field
        const nameMatch = email.from.match(/^([^<]+)</);
        if (nameMatch && !nameMatch[1].toLowerCase().includes('noreply')) {
          return {
            value: nameMatch[1].trim(),
            confidence: 0.8,
            sourceEmailId: email.id,
            sourceDate: email.date,
            extractionMethod: 'rule-based'
          };
        }
      }
    }
    return null;
  }

  /**
   * Builds comprehensive notes from all emails
   */
  private buildComprehensiveNotes(
    emails: ProcessedEmail[],
    statusHistory: Array<{ status: ApplicationStatus; date: string; emailId: string; confidence: number }>
  ): string {
    
    const notes: string[] = [];

    // Add status progression summary
    if (statusHistory.length > 1) {
      notes.push('📊 Status Progression:');
      statusHistory.forEach((entry, index) => {
        const date = new Date(entry.date).toLocaleDateString();
        const confidence = Math.round(entry.confidence * 100);
        notes.push(`  ${index + 1}. ${entry.status} (${date}, ${confidence}% confidence)`);
      });
      notes.push('');
    }

    // Add key information from each email
    const sortedEmails = [...emails].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    notes.push('📧 Email History:');
    sortedEmails.forEach((email, index) => {
      const date = new Date(email.date).toLocaleDateString();
      const subject = email.subject.length > 50 ? 
        email.subject.substring(0, 50) + '...' : email.subject;
      
      notes.push(`  ${index + 1}. ${date}: "${subject}"`);
      
      // Add key extracted data
      const keyData: string[] = [];
      if (email.extractedData.salary) keyData.push(`💰 ${email.extractedData.salary}`);
      if (email.extractedData.location) keyData.push(`📍 ${email.extractedData.location}`);
      if (email.extractedData.notes) keyData.push(`📝 ${email.extractedData.notes}`);
      
      if (keyData.length > 0) {
        notes.push(`     ${keyData.join(' | ')}`);
      }
    });

    return notes.join('\n');
  }

  /**
   * Formats source information for metadata
   */
  private formatSourceInfo(result: FieldExtractionResult): string {
    const date = new Date(result.sourceDate).toLocaleDateString();
    const confidence = Math.round(result.confidence * 100);
    return `${date} (${confidence}% confidence, ${result.extractionMethod})`;
  }
}

export const applicationMerger = new ApplicationMerger();
