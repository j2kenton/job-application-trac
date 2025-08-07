import { gmailAuth } from './GmailAuth';
import gmailFilters from '../../config/gmail-filters.json';
import syncSettings from '../../config/sync-settings.json';
import { googleAI } from '../googleAI';

// Note: Window.gapi types are defined in GmailAuth.ts

export interface GmailMessage {
  id: string;
  threadId: string;
  snippet: string;
  payload: MessagePart;
  internalDate: string;
  labelIds?: string[];
}

export interface MessagePart {
  headers?: Array<{ name: string; value: string }>;
  body?: {
    data?: string;
    attachmentId?: string;
    size?: number;
  };
  parts?: MessagePart[];
  mimeType?: string;
}

export interface ProcessedEmail {
  id: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  content: string;
  confidence: number;
  extractedData: {
    company?: string;
    position?: string;
    appliedDate?: string;
    contactEmail?: string;
    jobUrl?: string;
    salary?: string;
    location?: string;
    notes?: string;
    recruiter?: string;
    interviewer?: string;
  };
}

class GmailService {
  private getGmailClient() {
    const authState = gmailAuth.getAuthState();
    if (!authState.isAuthenticated) {
      throw new Error('Not authenticated with Gmail');
    }

    // For fallback authentication scenarios where Gmail API might not be fully initialized
    if (!window.gapi?.client?.gmail) {
      console.warn('Gmail API client not available - this is expected with fallback authentication');
      throw new Error('Gmail API not fully initialized - some features may be limited');
    }

    return window.gapi.client.gmail;
  }

  async fetchRecentEmails(maxResults: number = 50): Promise<GmailMessage[]> {
    try {
      const gmail = this.getGmailClient();
      
      // Build search query based on filters
      const query = this.buildSearchQuery();
      
      console.log('Gmail search query:', query);

      // Get message list
      const response = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults,
      });

      if (!response.result.messages) {
        return [];
      }

      // Fetch full message details
      const messages = await Promise.all(
        response.result.messages.map(async (msg: any) => {
          const messageResponse = await gmail.users.messages.get({
            userId: 'me',
            id: msg.id,
            format: 'full'
          });
          
          return messageResponse.result as GmailMessage;
        })
      );

      // Filter to latest email in each thread if configured
      if (syncSettings.processing.processThreadsOnly === 'latest') {
        return this.getLatestEmailsFromThreads(messages);
      }

      return messages;
    } catch (error) {
      console.error('Error fetching emails:', error);
      throw error;
    }
  }

  /**
   * Fetches all emails in a specific thread
   */
  async fetchEmailThread(threadId: string): Promise<GmailMessage[]> {
    try {
      const gmail = this.getGmailClient();
      
      // Get thread details
      const threadResponse = await gmail.users.threads.get({
        userId: 'me',
        id: threadId,
        format: 'full'
      });

      if (!threadResponse.result.messages) {
        return [];
      }

      return threadResponse.result.messages as GmailMessage[];
    } catch (error) {
      console.error('Error fetching email thread:', error);
      throw error;
    }
  }

  /**
   * Fetches all emails related to a specific application (by company/position matching)
   */
  async fetchRelatedApplicationEmails(
    company: string, 
    position: string, 
    maxLookbackDays: number = 90
  ): Promise<GmailMessage[]> {
    try {
      const gmail = this.getGmailClient();
      
      // Build search query for related emails
      const lookbackDate = new Date();
      lookbackDate.setDate(lookbackDate.getDate() - maxLookbackDays);
      
      const searchTerms = [
        company.toLowerCase(),
        position.toLowerCase()
      ].filter(term => term.length > 2); // Only search meaningful terms
      
      if (searchTerms.length === 0) {
        return [];
      }
      
      const query = [
        `after:${lookbackDate.toISOString().split('T')[0]}`,
        ...searchTerms.map(term => `"${term}"`)
      ].join(' ');
      
      console.log('Searching for related application emails:', query);

      // Get message list
      const response = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: 20 // Reasonable limit for related emails
      });

      if (!response.result.messages) {
        return [];
      }

      // Fetch full message details
      const messages = await Promise.all(
        response.result.messages.map(async (msg: any) => {
          const messageResponse = await gmail.users.messages.get({
            userId: 'me',
            id: msg.id,
            format: 'full'
          });
          
          return messageResponse.result as GmailMessage;
        })
      );

      console.log(`Found ${messages.length} related emails for ${company} - ${position}`);
      return messages;
      
    } catch (error) {
      console.error('Error fetching related application emails:', error);
      return [];
    }
  }

  private buildSearchQuery(): string {
    const parts: string[] = [];
    
    // Date filter - look back specified days
    const lookbackDate = new Date();
    lookbackDate.setDate(lookbackDate.getDate() - syncSettings.processing.lookbackDays);
    parts.push(`after:${lookbackDate.toISOString().split('T')[0]}`);

    // Build OR condition for labels and keywords
    const orConditions: string[] = [];
    
    // Optional label filter (sufficient condition)
    if (gmailFilters.optionalLabels && gmailFilters.optionalLabels.length > 0) {
      const labelQueries = gmailFilters.optionalLabels.map(label => `label:${label}`);
      orConditions.push(...labelQueries);
    }

    // Keyword filter (alternative condition)
    if (gmailFilters.includeKeywords && gmailFilters.includeKeywords.length > 0) {
      const keywordQueries = gmailFilters.includeKeywords.map(keyword => `"${keyword}"`);
      orConditions.push(...keywordQueries);
    }

    // Add OR conditions as a single group
    if (orConditions.length > 0) {
      parts.push(`(${orConditions.join(' OR ')})`);
    }

    // Exclude job boards
    if (gmailFilters.excludeJobBoards && gmailFilters.excludeJobBoards.length > 0) {
      const excludeQueries = gmailFilters.excludeJobBoards.map(domain => `-from:${domain}`);
      parts.push(...excludeQueries);
    }

    // Exclude training/webinar keywords
    if (gmailFilters.excludeKeywords && gmailFilters.excludeKeywords.length > 0) {
      const excludeQueries = gmailFilters.excludeKeywords.map(keyword => `-"${keyword}"`);
      parts.push(...excludeQueries);
    }

    return parts.join(' ');
  }

  private getLatestEmailsFromThreads(messages: GmailMessage[]): GmailMessage[] {
    const threadMap = new Map<string, GmailMessage>();
    
    messages.forEach(message => {
      const threadId = message.threadId;
      const existingMessage = threadMap.get(threadId);
      
      if (!existingMessage || parseInt(message.internalDate) > parseInt(existingMessage.internalDate)) {
        threadMap.set(threadId, message);
      }
    });
    
    return Array.from(threadMap.values());
  }

  async processEmail(message: GmailMessage): Promise<ProcessedEmail> {
    try {
      // Extract email content
      const emailData = this.extractEmailContent(message);
      
      // Use AI to extract job application data
      const extractedData = await this.extractJobData(emailData.content, emailData.subject, emailData.from);
      
      // Calculate confidence score
      let confidence = this.calculateConfidence(extractedData, emailData.content);
      
      // If confidence is low (< 30%), use Google AI for additional analysis
      if (confidence < 0.3 && googleAI.isConfigured()) {
        console.log(`Low confidence (${Math.round(confidence * 100)}%) - Running AI analysis...`);
        
        try {
          const aiResult = await googleAI.analyzeEmail(
            emailData.subject,
            emailData.content,
            emailData.from
          );
          
          console.log('AI Analysis Result:', aiResult);
          
          if (aiResult.isJobRelated && aiResult.confidence > confidence) {
            // Use AI confidence and merge extracted data
            confidence = aiResult.confidence;
            
            // Merge AI extracted data with existing data (AI takes precedence)
            Object.assign(extractedData, {
              ...extractedData,
              ...aiResult.extractedData,
              notes: aiResult.reasoning + (extractedData.notes ? '\n' + extractedData.notes : '')
            });
            
            console.log(`AI boosted confidence to ${Math.round(confidence * 100)}%`);
          }
        } catch (aiError) {
          console.error('AI analysis failed:', aiError);
        }
      }

      return {
        id: message.id,
        subject: emailData.subject,
        from: emailData.from,
        to: emailData.to,
        date: new Date(parseInt(message.internalDate)).toISOString(),
        content: emailData.content,
        confidence,
        extractedData
      };
    } catch (error) {
      console.error('Error processing email:', error);
      throw error;
    }
  }

  private extractEmailContent(message: GmailMessage): {
    subject: string;
    from: string;
    to: string;
    content: string;
  } {
    const headers = message.payload.headers || [];
    
    const getHeader = (name: string) => {
      const header = headers.find(h => h.name?.toLowerCase() === name.toLowerCase());
      return header?.value || '';
    };

    const subject = getHeader('Subject');
    const from = getHeader('From');
    const to = getHeader('To');
    
    console.log(`Processing email: ${subject} from ${from}`);
    console.log('Message payload structure:', {
      mimeType: message.payload.mimeType,
      hasBody: !!message.payload.body,
      hasData: !!message.payload.body?.data,
      hasAttachmentId: !!message.payload.body?.attachmentId,
      hasParts: !!message.payload.parts,
      partsCount: message.payload.parts?.length || 0,
      snippet: message.snippet?.substring(0, 100)
    });
    
    // Extract email body
    let content = '';
    
    const extractText = (part: MessagePart): string => {
      console.log('Processing part:', { mimeType: part.mimeType, hasData: !!part.body?.data, hasAttachmentId: !!part.body?.attachmentId, hasParts: !!part.parts });
      
      // Handle text/plain content
      if (part.mimeType === 'text/plain' && part.body?.data) {
        try {
          const decoded = decodeURIComponent(escape(atob(part.body.data)));
          console.log('Decoded plain text length:', decoded.length);
          return decoded;
        } catch (error) {
          console.warn('Failed to decode plain text content:', error);
          return '';
        }
      }
      
      // Handle text/html content
      if (part.mimeType === 'text/html' && part.body?.data) {
        try {
          const htmlContent = decodeURIComponent(escape(atob(part.body.data)));
          console.log('Decoded HTML content length:', htmlContent.length);
          // Simple HTML to text conversion (in production, use a proper library)
          return htmlContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        } catch (error) {
          console.warn('Failed to decode HTML content:', error);
          return '';
        }
      }
      
      // Handle multipart content
      if (part.parts && part.parts.length > 0) {
        const texts = part.parts.map(extractText).filter(text => text.length > 0);
        console.log('Found', texts.length, 'text parts from', part.parts.length, 'total parts');
        return texts.join('\n\n');
      }
      
      // Handle cases where body data might be in an attachment
      if (part.body?.attachmentId && part.mimeType?.startsWith('text/')) {
        console.warn('Text content appears to be an attachment, may need separate API call');
        return '';
      }
      
      return '';
    };
    
    content = extractText(message.payload);
    
    // If we couldn't extract content, try fallback to snippet
    if (!content || content.trim().length === 0) {
      console.log('No content extracted, using snippet as fallback:', message.snippet);
      content = message.snippet || '';
    }
    
    console.log('Final email content length:', content.length);
    console.log('Content preview (first 200 chars):', content.substring(0, 200));

    return { subject, from, to, content };
  }

  private async extractJobData(content: string, subject: string, from: string): Promise<any> {
    try {
      // Simple pattern matching for job application data
      // In a real implementation, you might want to use a more sophisticated AI service
      const extractedData: any = {};

      // Extract company name from email signature or subject
      // Avoid extracting LinkedIn as the company for LinkedIn notification emails
      const companyPatterns = [
        /from:?\s*(.+?)@(.+?)\./i,
        /company:?\s*(.+?)$/im,
        /regards,?\s*(.+?)$/im
      ];

      for (const pattern of companyPatterns) {
        const match = content.match(pattern) || subject.match(pattern);
        if (match) {
          const potentialCompany = match[1]?.trim();
          // Don't extract LinkedIn as company name for LinkedIn notification emails
          if (potentialCompany && 
              !potentialCompany.toLowerCase().includes('linkedin') &&
              !potentialCompany.toLowerCase().includes('noreply') &&
              !potentialCompany.toLowerCase().includes('no-reply')) {
            extractedData.company = potentialCompany;
            break;
          }
        }
      }

      // For LinkedIn emails, try to extract actual company from content
      const isLinkedInEmail = content.toLowerCase().includes('linkedin') || 
                             subject.toLowerCase().includes('linkedin');
      
      if (isLinkedInEmail && !extractedData.company) {
        // Look for company names in LinkedIn notification patterns
        const linkedInCompanyPatterns = [
          /at\s+([^,\n]+?)(?:\s+is\s+hiring|\s+posted)/i,
          /([^,\n]+?)\s+is\s+hiring/i,
          /position\s+at\s+([^,\n]+)/i,
          /job\s+at\s+([^,\n]+)/i,
          /opportunity\s+at\s+([^,\n]+)/i
        ];

        for (const pattern of linkedInCompanyPatterns) {
          const match = content.match(pattern);
          if (match) {
            const companyName = match[1]?.trim();
            if (companyName && 
                !companyName.toLowerCase().includes('linkedin') &&
                companyName.length > 2 && 
                companyName.length < 100) {
              extractedData.company = companyName;
              break;
            }
          }
        }
      }

      // Extract position/job title
      const positionPatterns = [
        /position:?\s*(.+?)$/im,
        /role:?\s*(.+?)$/im,
        /job:?\s*(.+?)$/im,
        /application for\s*(.+?)$/im
      ];

      for (const pattern of positionPatterns) {
        const match = content.match(pattern) || subject.match(pattern);
        if (match) {
          extractedData.position = match[1]?.trim();
          break;
        }
      }

      // Extract contact email and recruiter name - handle various formats
      // First try to extract from "Name <email@domain.com>" format in content
      const nameEmailMatch = content.match(/([^<>\n]+)\s*<([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>/);
      if (nameEmailMatch) {
        const recruiterName = nameEmailMatch[1].trim();
        const email = nameEmailMatch[2];
        
        // Don't extract LinkedIn as recruiter name
        if (!recruiterName.toLowerCase().includes('linkedin') &&
            !recruiterName.toLowerCase().includes('noreply') &&
            !recruiterName.toLowerCase().includes('no-reply') &&
            recruiterName.length > 2 && 
            recruiterName.length < 100) {
          extractedData.recruiter = recruiterName;
        }
        
        extractedData.contactEmail = email;
      } else {
        // Fallback: just extract email without name
        const emailMatch = content.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
        if (emailMatch) {
          extractedData.contactEmail = emailMatch[1];
        }
      }

      // Also try to extract recruiter name from the "From" header if not found in content
      if (!extractedData.recruiter && from) {
        const nameMatch = from.match(/^([^<]+)</);
        if (nameMatch) {
          const recruiterName = nameMatch[1].trim();
          
          // Don't extract LinkedIn as recruiter name, or system names
          if (!recruiterName.toLowerCase().includes('linkedin') &&
              !recruiterName.toLowerCase().includes('noreply') &&
              !recruiterName.toLowerCase().includes('no-reply') &&
              !recruiterName.toLowerCase().includes('donotreply') &&
              !recruiterName.toLowerCase().includes('support') &&
              !recruiterName.toLowerCase().includes('team') &&
              !recruiterName.toLowerCase().includes('notifications') &&
              recruiterName.length > 2 && 
              recruiterName.length < 100) {
            extractedData.recruiter = recruiterName;
          }
        }
      }

      // Extract interviewer information from interview-related emails
      const isInterviewEmail = subject.toLowerCase().includes('interview') || 
                              content.toLowerCase().includes('interview') ||
                              subject.toLowerCase().includes('ראיון') ||
                              content.toLowerCase().includes('ראיון') ||
                              content.toLowerCase().includes('הראיון');

      if (isInterviewEmail) {
        // Try to extract interviewer name from various patterns
        const interviewerPatterns = [
          // "Interview with John Smith"
          /interview\s+with\s+([^,\n]+)/i,
          // "ראיון עם יוחנן כהן"
          /ראיון\s+עם\s+([^,\n]+)/i,
          // "You will be interviewing with Sarah"
          /interviewing\s+with\s+([^,\n]+)/i,
          // "Your interviewer will be Mike"
          /interviewer\s+(?:will\s+be|is)\s+([^,\n]+)/i,
          // "Meeting with John (Interview)"
          /meeting\s+with\s+([^,\n(]+)(?:\s*\([^)]*interview[^)]*\))?/i,
          // "Interview: John Smith"
          /interview:\s*([^,\n]+)/i,
          // From signature in interview emails
          /best\s+regards,?\s*([^,\n]+)/i,
          /regards,?\s*([^,\n]+)/i,
          // Hebrew patterns
          /בברכה,?\s*([^,\n]+)/i,
          /מאמן\/ת:\s*([^,\n]+)/i
        ];

        for (const pattern of interviewerPatterns) {
          const match = content.match(pattern) || subject.match(pattern);
          if (match) {
            const interviewerName = match[1].trim();
            
            // Filter out generic terms and system names
            if (!interviewerName.toLowerCase().includes('linkedin') &&
                !interviewerName.toLowerCase().includes('team') &&
                !interviewerName.toLowerCase().includes('hr') &&
                !interviewerName.toLowerCase().includes('department') &&
                !interviewerName.toLowerCase().includes('committee') &&
                !interviewerName.toLowerCase().includes('panel') &&
                !interviewerName.toLowerCase().includes('group') &&
                interviewerName.length > 2 && 
                interviewerName.length < 100 &&
                !/^\d+$/.test(interviewerName) && // Not just numbers
                !/^[^a-zA-Zא-ת]+$/.test(interviewerName)) { // Contains letters
              extractedData.interviewer = interviewerName;
              break;
            }
          }
        }

        // If no interviewer found in content, try extracting from "From" field for interview emails
        if (!extractedData.interviewer && from) {
          const nameMatch = from.match(/^([^<]+)</);
          if (nameMatch) {
            const interviewerName = nameMatch[1].trim();
            
            // For interview emails, be more permissive about extracting from sender
            if (!interviewerName.toLowerCase().includes('linkedin') &&
                !interviewerName.toLowerCase().includes('noreply') &&
                !interviewerName.toLowerCase().includes('no-reply') &&
                !interviewerName.toLowerCase().includes('donotreply') &&
                !interviewerName.toLowerCase().includes('notifications') &&
                interviewerName.length > 2 && 
                interviewerName.length < 100) {
              extractedData.interviewer = interviewerName;
            }
          }
        }
      }

      // Extract URLs - distinguish between job URLs and meeting URLs
      const urlMatches = content.match(/(https?:\/\/[^\s]+)/g);
      if (urlMatches) {
        // Look for video meeting URLs first
        const meetingUrl = urlMatches.find(url => 
          url.toLowerCase().includes('zoom') ||
          url.toLowerCase().includes('teams') ||
          url.toLowerCase().includes('meet.google') ||
          url.toLowerCase().includes('webex') ||
          url.toLowerCase().includes('gotomeeting') ||
          url.toLowerCase().includes('skype')
        );
        
        if (meetingUrl) {
          extractedData.location = meetingUrl;
        }
        
        // Set job URL to first non-meeting URL
        const jobUrl = urlMatches.find(url => !meetingUrl || url !== meetingUrl);
        if (jobUrl) {
          extractedData.jobUrl = jobUrl;
        }
      }

      // Extract physical location/address
      if (!extractedData.location) {
        // Look for address patterns
        const addressPatterns = [
          /(?:address|location|venue|office):?\s*(.+?)(?:\n|$)/i,
          /(?:at|@)\s+([^,\n]+(?:street|st|avenue|ave|road|rd|drive|dr|boulevard|blvd)[^,\n]*)/i,
          /(\d+\s+[^,\n]+(?:street|st|avenue|ave|road|rd|drive|dr|boulevard|blvd)[^,\n]*)/i,
          /(?:located at|held at|visit us at):?\s*(.+?)(?:\n|$)/i
        ];

        for (const pattern of addressPatterns) {
          const match = content.match(pattern);
          if (match) {
            extractedData.location = match[1]?.trim();
            break;
          }
        }
      }

      // Set applied date to current date if this seems like an application confirmation
      if (content.toLowerCase().includes('application') || content.toLowerCase().includes('applied')) {
        extractedData.appliedDate = new Date().toISOString().split('T')[0];
      }

      // Extract salary information
      const salaryPatterns = [
        /\$[\d,]+(?:\.\d{2})?/,
        /salary:?\s*(.+?)$/im,
        /compensation:?\s*(.+?)$/im
      ];

      for (const pattern of salaryPatterns) {
        const match = content.match(pattern);
        if (match) {
          extractedData.salary = match[0]?.trim();
          break;
        }
      }

      return extractedData;
    } catch (error) {
      console.error('Error extracting job data:', error);
      return {};
    }
  }

  private calculateConfidence(extractedData: any, content: string): number {
    let confidence = 0;
    const debugInfo: any = { extractedData, contentLength: content.length };
    
    // Base confidence if we found company and position
    if (extractedData.company && extractedData.position) {
      confidence += 0.4;
      debugInfo.companyAndPosition = 0.4;
    } else if (extractedData.company || extractedData.position) {
      confidence += 0.2;
      debugInfo.companyOrPosition = 0.2;
    }

    // Check for job-related keywords (case-insensitive, with word boundaries)
    const jobKeywords = [
      'interview', 'position', 'role', 'application', 'candidate', 'hire', 'offer', 'recruiting', 'recruiter', 'recruit', 'invitation',
      'ראיון', 'הראיון', 'עמדה', 'העמדה', 'תפקיד', 'התפקיד', 'בקשה', 'הבקשה',
      'מועמד', 'המועמד', 'מועמדת', 'המועמדת', 'מועמדים', 'המועמדים', 'מועמדות', 'המועמדות',
      'לשכור', 'לגייס', 'הצעה', 'ההצעה', 'הצעות', 'ההצעות', 'גיוס', 'הגיוס', 'מגייס', 'המגייס', 'זימון', 'הזימון'
    ];
    
    const lowerContent = content.toLowerCase();
    
    // Debug: Test specific keyword that's failing
    const testKeyword = "הראיון";
    console.log(`DEBUG: Testing keyword "${testKeyword}":`);
    console.log(`Content includes keyword: ${lowerContent.includes(testKeyword.toLowerCase())}`);
    console.log(`Content length: ${lowerContent.length}`);
    console.log(`Content sample: "${lowerContent.substring(0, 100)}"`);
    console.log(`Looking for: "${testKeyword.toLowerCase()}"`);
    
    const matchedKeywords = jobKeywords.filter(keyword => {
      const lowerKeyword = keyword.toLowerCase();
      
      // First try simple substring matching
      const simpleMatch = lowerContent.includes(lowerKeyword);
      
      // More flexible matching for Hebrew and punctuation
      let flexibleMatch = false;
      try {
        // Create pattern that allows for punctuation immediately before/after
        // This handles cases like "הראיון!" or "הראיון," or "הראיון."
        const escapedKeyword = lowerKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = new RegExp(`(^|[\\s\\p{P}\\p{Z}]|>)${escapedKeyword}(?=[\\s\\p{P}\\p{Z}]|<|$)`, 'giu');
        flexibleMatch = pattern.test(lowerContent);
      } catch (e) {
        console.warn('Regex pattern failed for keyword:', keyword, e);
      }
      
      // Additional Hebrew-specific matching (handle RTL and mixed text)  
      let hebrewSpecificMatch = false;
      if (/[\u05D0-\u05EA]/.test(keyword)) { // Correct Hebrew Unicode range
        try {
          // More permissive matching for Hebrew text
          const hebrewPattern = new RegExp(lowerKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
          hebrewSpecificMatch = hebrewPattern.test(lowerContent);
        } catch (e) {
          console.warn('Hebrew pattern failed for keyword:', keyword, e);
        }
      }
      
      const matches = simpleMatch || flexibleMatch || hebrewSpecificMatch;
      if (matches) {
        console.log(`Keyword "${keyword}" matched in content:`, {
          simple: simpleMatch,
          flexible: flexibleMatch, 
          hebrewSpecific: hebrewSpecificMatch
        });
        
        // Log ALL occurrences and their contexts
        const regex = new RegExp(lowerKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        let match;
        let matchCount = 0;
        while ((match = regex.exec(lowerContent)) !== null && matchCount < 5) {
          const start = Math.max(0, match.index - 30);
          const end = Math.min(lowerContent.length, match.index + match[0].length + 30);
          console.log(`Match ${++matchCount} context: "${lowerContent.substring(start, end)}"`);
          
          // Prevent infinite loop on zero-length matches
          if (match.index === regex.lastIndex) {
            regex.lastIndex++;
          }
        }
      } else {
        // Debug failed matches for Hebrew keywords
        if (/[\u05D0-\u05EA]/.test(keyword)) {
          console.log(`DEBUG: Hebrew keyword "${keyword}" did not match. Testing simple inclusion:`, lowerContent.includes(lowerKeyword));
        }
      }
      return matches;
    });
    
    const keywordScore = Math.min(matchedKeywords.length * 0.1, 0.4);
    confidence += keywordScore;
    debugInfo.matchedKeywords = matchedKeywords;
    debugInfo.keywordScore = keywordScore;

    // If found by Gmail search with job keywords, give base confidence
    if (matchedKeywords.length > 0) {
      confidence = Math.max(confidence, 0.3); // Minimum confidence if keywords match
      debugInfo.minConfidenceApplied = true;
    }

    // Check for exclusion keywords (negative confidence)
    const exclusionMatches = gmailFilters.excludeKeywords.filter(keyword =>
      lowerContent.includes(keyword.toLowerCase())
    );
    const exclusionPenalty = exclusionMatches.length * 0.2;
    confidence -= exclusionPenalty;
    debugInfo.exclusionMatches = exclusionMatches;
    debugInfo.exclusionPenalty = exclusionPenalty;

    // Check for context exclusions
    const contextExclusions = gmailFilters.contextExclusions.filter(phrase =>
      lowerContent.includes(phrase.toLowerCase())
    );
    const contextPenalty = contextExclusions.length * 0.3;
    confidence -= contextPenalty;
    debugInfo.contextExclusions = contextExclusions;
    debugInfo.contextPenalty = contextPenalty;

    // Additional data points increase confidence
    let bonusScore = 0;
    if (extractedData.contactEmail) bonusScore += 0.1;
    if (extractedData.jobUrl) bonusScore += 0.1;
    if (extractedData.salary) bonusScore += 0.1;
    confidence += bonusScore;
    debugInfo.bonusScore = bonusScore;

    const finalConfidence = Math.max(0, Math.min(1, confidence));
    debugInfo.finalConfidence = finalConfidence;
    
    console.log('Confidence calculation:', debugInfo);
    
    return finalConfidence;
  }

  async addLabelToEmail(messageId: string, labelName: string): Promise<void> {
    try {
      const gmail = this.getGmailClient();
      
      // First, check if label exists, create if not
      const labelId = await this.ensureLabelExists(labelName);
      
      // Add label to message
      await gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        resource: {
          addLabelIds: [labelId],
          removeLabelIds: []
        }
      });
    } catch (error) {
      console.error('Error adding label to email:', error);
      throw error;
    }
  }

  private async ensureLabelExists(labelName: string): Promise<string> {
    try {
      const gmail = this.getGmailClient();
      
      // List existing labels
      const labelsResponse = await gmail.users.labels.list({
        userId: 'me'
      });
      
      const existingLabel = labelsResponse.result.labels?.find(
        (label: any) => label.name === labelName
      );
      
      if (existingLabel) {
        return existingLabel.id;
      }
      
      // Create new label
      const createResponse = await gmail.users.labels.create({
        userId: 'me',
        resource: {
          name: labelName,
          labelListVisibility: 'labelShow',
          messageListVisibility: 'show'
        }
      });
      
      return createResponse.result.id;
    } catch (error) {
      console.error('Error ensuring label exists:', error);
      throw error;
    }
  }

  async getProcessingStats(): Promise<{
    totalEmails: number;
    processedEmails: number;
    autoProcessed: number;
    inReviewQueue: number;
    discarded: number;
  }> {
    // This would be implemented to track processing statistics
    // For now, return mock data
    return {
      totalEmails: 0,
      processedEmails: 0,
      autoProcessed: 0,
      inReviewQueue: 0,
      discarded: 0
    };
  }
}

export const gmailService = new GmailService();
