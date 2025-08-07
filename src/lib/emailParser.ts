import { ParsedEmailData, ApplicationStatus } from './types';
import { aiStatusDetector, StatusAnalysis } from './ai-status-detector';

export interface EnhancedParsedEmailData extends ParsedEmailData {
  detectedStatus?: ApplicationStatus;
  statusAnalysis?: StatusAnalysis;
}

export function parseEmailContent(emailContent: string): ParsedEmailData {
  const lowercaseContent = emailContent.toLowerCase();
  
  // Common patterns for extracting information
  const companyPatterns = [
    /(?:from|at|with|@)\s+([A-Za-z0-9\s&.,'-]+?)(?:\s+(?:team|careers|hr|recruiting|talent))/i,
    /([A-Za-z0-9\s&.,'-]+?)\s+(?:is|has|wants|would like|team|careers)/i,
    /thank you for (?:applying to|your interest in)\s+([A-Za-z0-9\s&.,'-]+)/i,
  ];

  const positionPatterns = [
    /(?:position|role|job|opening)[\s:]+([A-Za-z0-9\s\-,.']+?)(?:\s+(?:at|with|position|role))/i,
    /(?:for the|as a|as an)\s+([A-Za-z0-9\s\-,.']+?)(?:\s+(?:position|role|at))/i,
    /(?:applied for|applying for|interested in)[\s:]+([A-Za-z0-9\s\-,.']+)/i,
  ];

  const emailPatterns = [
    /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
  ];

  const urlPatterns = [
    /(https?:\/\/[^\s<>"{}|\\^`[\]]+)/g,
  ];

  const datePatterns = [
    /(\d{1,2}\/\d{1,2}\/\d{4})/,
    /(\d{4}-\d{2}-\d{2})/,
    /((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2},?\s+\d{4})/i,
  ];

  let company = '';
  let position = '';
  let contactEmail = '';
  let jobUrl = '';
  let appliedDate = '';

  // Extract company
  for (const pattern of companyPatterns) {
    const match = emailContent.match(pattern);
    if (match && match[1]) {
      company = match[1].trim().replace(/[.,;]$/, '');
      break;
    }
  }

  // Extract position
  for (const pattern of positionPatterns) {
    const match = emailContent.match(pattern);
    if (match && match[1]) {
      position = match[1].trim().replace(/[.,;]$/, '');
      break;
    }
  }

  // Extract emails (get the first one that's not common no-reply patterns)
  const emailMatches = emailContent.match(emailPatterns[0]);
  if (emailMatches) {
    const filteredEmails = emailMatches.filter(email => 
      !email.includes('noreply') && 
      !email.includes('no-reply') &&
      !email.includes('donotreply')
    );
    if (filteredEmails.length > 0) {
      contactEmail = filteredEmails[0];
    }
  }

  // Extract URLs (get the first job-related URL)
  const urlMatches = emailContent.match(urlPatterns[0]);
  if (urlMatches) {
    const jobUrls = urlMatches.filter(url => 
      lowercaseContent.includes('job') || 
      lowercaseContent.includes('career') ||
      lowercaseContent.includes('position') ||
      url.includes('job') ||
      url.includes('career')
    );
    if (jobUrls.length > 0) {
      jobUrl = jobUrls[0];
    }
  }

  // Extract date
  for (const pattern of datePatterns) {
    const match = emailContent.match(pattern);
    if (match && match[1]) {
      appliedDate = match[1];
      break;
    }
  }

  return {
    company,
    position,
    appliedDate,
    contactEmail,
    jobUrl,
    rawContent: emailContent
  };
}

/**
 * Enhanced email parsing with AI-powered status detection
 */
export async function parseEmailWithStatusDetection(
  emailSubject: string,
  emailContent: string,
  senderEmail: string,
  currentStatus?: ApplicationStatus
): Promise<EnhancedParsedEmailData> {
  
  // First, do the basic parsing
  const basicParsedData = parseEmailContent(emailContent);
  
  try {
    // Use AI to detect the application status
    const statusAnalysis = await aiStatusDetector.detectApplicationStatus(
      emailSubject,
      emailContent,
      senderEmail,
      currentStatus
    );
    
    console.log('AI Status Detection Result:', {
      subject: emailSubject.substring(0, 50) + '...',
      detectedStatus: statusAnalysis.detectedStatus,
      confidence: statusAnalysis.confidence,
      reasoning: statusAnalysis.reasoning
    });
    
    return {
      ...basicParsedData,
      detectedStatus: statusAnalysis.detectedStatus,
      statusAnalysis
    };
    
  } catch (error) {
    console.warn('AI status detection failed, using basic parsing:', error);
    
    // Fallback to basic parsing without status detection
    return {
      ...basicParsedData,
      detectedStatus: currentStatus || 'applied'
    };
  }
}

/**
 * Quick status detection for existing applications
 */
export async function detectStatusFromEmail(
  emailSubject: string,
  emailContent: string,
  senderEmail: string,
  currentStatus: ApplicationStatus
): Promise<{
  newStatus: ApplicationStatus;
  confidence: number;
  reasoning: string;
  shouldUpdate: boolean;
}> {
  
  try {
    const statusAnalysis = await aiStatusDetector.detectApplicationStatus(
      emailSubject,
      emailContent,
      senderEmail,
      currentStatus
    );
    
    // Check if the detected status represents a meaningful change
    const shouldUpdate = 
      statusAnalysis.detectedStatus !== currentStatus &&
      statusAnalysis.confidence > 0.6 &&
      aiStatusDetector.isValidStatusTransition(currentStatus, statusAnalysis.detectedStatus);
    
    return {
      newStatus: statusAnalysis.detectedStatus,
      confidence: statusAnalysis.confidence,
      reasoning: statusAnalysis.reasoning,
      shouldUpdate
    };
    
  } catch (error) {
    console.error('Status detection failed:', error);
    return {
      newStatus: currentStatus,
      confidence: 0,
      reasoning: 'Status detection failed',
      shouldUpdate: false
    };
  }
}
