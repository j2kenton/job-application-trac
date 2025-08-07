import { googleAI } from './googleAI';
import { ApplicationStatus } from './types';

export interface StatusAnalysis {
  detectedStatus: ApplicationStatus;
  confidence: number;
  reasoning: string;
  keyIndicators: string[];
  suggestedNextAction: string;
  extractedDetails?: {
    interviewDate?: string;
    interviewTime?: string;
    interviewLocation?: string;
    interviewType?: string; // 'phone', 'video', 'in-person', 'panel'
    rejectionReason?: string;
    offerDetails?: string;
    salary?: string;
    nextSteps?: string;
  };
}

class AIStatusDetector {
  /**
   * Analyzes email content to detect the job application status using AI
   */
  async detectApplicationStatus(
    emailSubject: string,
    emailContent: string,
    senderEmail: string,
    currentStatus?: ApplicationStatus
  ): Promise<StatusAnalysis> {
    
    try {
      // First try rule-based detection for quick common patterns
      const ruleBasedResult = this.detectStatusByRules(emailSubject, emailContent);
      
      // Use AI for sophisticated analysis
      let aiResult: StatusAnalysis | null = null;
      if (googleAI.isConfigured()) {
        try {
          aiResult = await this.getAIStatusAnalysis(
            emailSubject, 
            emailContent, 
            senderEmail, 
            currentStatus,
            ruleBasedResult
          );
        } catch (error) {
          console.warn('AI status analysis failed, using rule-based detection:', error);
        }
      }
      
      // Combine results - prefer AI if high confidence, otherwise use rules
      if (aiResult && aiResult.confidence > 0.7) {
        return aiResult;
      } else {
        return ruleBasedResult;
      }
      
    } catch (error) {
      console.error('Status detection failed:', error);
      
      // Fallback to unknown status
      return {
        detectedStatus: currentStatus || 'applied',
        confidence: 0.1,
        reasoning: 'Failed to analyze email content',
        keyIndicators: [],
        suggestedNextAction: 'Manual review required'
      };
    }
  }

  /**
   * Rule-based status detection for common patterns
   */
  private detectStatusByRules(subject: string, content: string): StatusAnalysis {
    const subjectLower = subject.toLowerCase();
    const contentLower = content.toLowerCase();
    const combinedText = `${subjectLower} ${contentLower}`;
    
    // Interview patterns
    const interviewPatterns = [
      'interview', 'ראיון', 'הראיון', 'zoom', 'teams', 'meet', 'schedule', 'invitation',
      'invite you', 'would like to', 'phone call', 'video call', 'in person',
      'next step', 'next steps', 'צעד הבא', 'שלב הבא', 'לזמן', 'זימון'
    ];
    
    // Rejection patterns
    const rejectionPatterns = [
      'unfortunately', 'regret', 'declined', 'not selected', 'not moving forward',
      'decided to go', 'another candidate', 'other candidates', 'thank you for your interest',
      'לצערנו', 'למרבה הצער', 'לא נבחרת', 'לא עברת', 'החלטנו', 'מועמד אחר'
    ];
    
    // Offer patterns
    const offerPatterns = [
      'offer', 'congratulations', 'pleased to offer', 'happy to offer', 'job offer',
      'offer letter', 'compensation', 'salary', 'start date', 'welcome aboard',
      'הצעה', 'הצעת עבודה', 'ברכות', 'שמחים להציע', 'חבילת תגמולים', 'תאריך התחלה'
    ];
    
    // Withdrawal patterns
    const withdrawalPatterns = [
      'withdraw', 'no longer interested', 'pursuing other', 'different direction',
      'changed my mind', 'cancel', 'retract', 'לחזור בי', 'לבטל', 'לא מעוניין'
    ];
    
    // Check for patterns
    let detectedStatus: ApplicationStatus = 'applied';
    let confidence = 0.5;
    let reasoning = 'Default status based on application context';
    let keyIndicators: string[] = [];
    
    if (interviewPatterns.some(pattern => combinedText.includes(pattern))) {
      detectedStatus = 'interview';
      confidence = 0.8;
      reasoning = 'Email contains interview-related keywords';
      keyIndicators = interviewPatterns.filter(pattern => combinedText.includes(pattern));
    } else if (rejectionPatterns.some(pattern => combinedText.includes(pattern))) {
      detectedStatus = 'rejected';
      confidence = 0.85;
      reasoning = 'Email contains rejection language';
      keyIndicators = rejectionPatterns.filter(pattern => combinedText.includes(pattern));
    } else if (offerPatterns.some(pattern => combinedText.includes(pattern))) {
      detectedStatus = 'offer';
      confidence = 0.9;
      reasoning = 'Email contains job offer language';
      keyIndicators = offerPatterns.filter(pattern => combinedText.includes(pattern));
    } else if (withdrawalPatterns.some(pattern => combinedText.includes(pattern))) {
      detectedStatus = 'withdrawn';
      confidence = 0.75;
      reasoning = 'Email indicates application withdrawal';
      keyIndicators = withdrawalPatterns.filter(pattern => combinedText.includes(pattern));
    }
    
    return {
      detectedStatus,
      confidence,
      reasoning,
      keyIndicators,
      suggestedNextAction: this.getSuggestedAction(detectedStatus)
    };
  }

  /**
   * Uses AI to analyze email content for job application status
   */
  private async getAIStatusAnalysis(
    subject: string,
    content: string,
    senderEmail: string,
    currentStatus?: ApplicationStatus,
    ruleBasedHint?: StatusAnalysis
  ): Promise<StatusAnalysis> {
    
    const prompt = `
Analyze this email to determine the job application status. This email is related to a job application.

Email Details:
- Subject: ${subject}
- From: ${senderEmail}
- Current Status: ${currentStatus || 'unknown'}

Email Content:
${content}

Rule-based hint: ${ruleBasedHint ? `${ruleBasedHint.detectedStatus} (${ruleBasedHint.confidence})` : 'none'}

Your task is to determine which of these statuses best describes this email:

1. **applied** - Initial application submitted, confirmation, or acknowledgment
2. **interview** - Interview invitation, scheduling, confirmation, or follow-up
3. **offer** - Job offer, offer letter, salary negotiation, or acceptance
4. **rejected** - Application rejection, position filled, or "no thank you"
5. **withdrawn** - Candidate withdrawing application or company withdrawing offer

Look for these indicators:
- **Interview**: "schedule", "invite", "interview", "zoom", "teams", "call", "meet", "next step"
- **Rejection**: "unfortunately", "regret", "not selected", "another candidate", "decided to go"
- **Offer**: "offer", "congratulations", "pleased to offer", "compensation", "salary", "start date"
- **Withdrawn**: "withdraw", "no longer interested", "pursuing other", "cancel"
- **Applied**: "received your application", "thank you for applying", "application submitted"

Also extract any relevant details like:
- Interview date/time/location/type
- Rejection reasons
- Offer details (salary, start date, etc.)
- Next steps mentioned

Consider the email tone, sender (HR, recruiter, hiring manager), and context.

Respond in JSON format:
{
  "detectedStatus": "status_name",
  "confidence": 0.95,
  "reasoning": "detailed explanation",
  "keyIndicators": ["indicator1", "indicator2"],
  "extractedDetails": {
    "interviewDate": "2024-01-15",
    "interviewTime": "14:00",
    "interviewLocation": "Office/Zoom/Phone",
    "interviewType": "video",
    "rejectionReason": "reason if applicable",
    "offerDetails": "details if applicable",
    "salary": "amount if mentioned",
    "nextSteps": "what happens next"
  },
  "suggestedNextAction": "what user should do"
}
    `;

    try {
      const result = await googleAI.analyzeEmail(
        `Status Analysis: ${subject}`,
        prompt,
        senderEmail,
        {
          initialConfidence: ruleBasedHint?.confidence || 0.5,
          isInReviewQueue: false,
          hasComplexContent: true
        }
      );
      
      // Parse the AI response if it's JSON
      let parsedResult;
      try {
        const extractedDataStr = typeof result.extractedData === 'string' 
          ? result.extractedData 
          : JSON.stringify(result.extractedData || {});
        parsedResult = JSON.parse(extractedDataStr);
      } catch {
        // If not JSON, extract from other fields
        parsedResult = this.extractFromAIResult(result, ruleBasedHint);
      }
      
      return {
        detectedStatus: parsedResult.detectedStatus || ruleBasedHint?.detectedStatus || 'applied',
        confidence: Math.min(parsedResult.confidence || result.confidence, 0.95),
        reasoning: parsedResult.reasoning || result.reasoning || 'AI analysis completed',
        keyIndicators: parsedResult.keyIndicators || [],
        suggestedNextAction: parsedResult.suggestedNextAction || this.getSuggestedAction(parsedResult.detectedStatus),
        extractedDetails: parsedResult.extractedDetails
      };
      
    } catch (error) {
      console.error('AI status analysis failed:', error);
      throw error;
    }
  }

  /**
   * Extracts status information from AI result when not in JSON format
   */
  private extractFromAIResult(aiResult: any, ruleBasedHint?: StatusAnalysis): any {
    // Fallback extraction logic
    const notes = (aiResult.notes || '').toLowerCase();
    
    if (notes.includes('interview') || notes.includes('schedule')) {
      return { detectedStatus: 'interview', confidence: 0.7 };
    } else if (notes.includes('reject') || notes.includes('unfortunately')) {
      return { detectedStatus: 'rejected', confidence: 0.8 };
    } else if (notes.includes('offer') || notes.includes('congratulations')) {
      return { detectedStatus: 'offer', confidence: 0.9 };
    } else if (notes.includes('withdraw')) {
      return { detectedStatus: 'withdrawn', confidence: 0.7 };
    }
    
    return ruleBasedHint || { detectedStatus: 'applied', confidence: 0.5 };
  }

  /**
   * Gets suggested action based on detected status
   */
  private getSuggestedAction(status: ApplicationStatus): string {
    const actions: Record<ApplicationStatus, string> = {
      applied: 'Wait for response or follow up if needed',
      interview: 'Prepare for interview and confirm attendance',
      offer: 'Review offer details and respond appropriately',
      rejected: 'Update application tracking and continue job search',
      withdrawn: 'Mark as withdrawn and continue with other opportunities'
    };
    
    return actions[status] || 'Review and update application status';
  }

  /**
   * Validates if a status transition makes sense
   */
  isValidStatusTransition(from: ApplicationStatus, to: ApplicationStatus): boolean {
    const validTransitions: Record<ApplicationStatus, ApplicationStatus[]> = {
      applied: ['interview', 'rejected', 'withdrawn', 'offer'],
      interview: ['offer', 'rejected', 'withdrawn', 'interview'], // Multiple interviews
      offer: ['rejected', 'withdrawn'], // Can reject offer or withdraw
      rejected: [], // Terminal state
      withdrawn: [] // Terminal state
    };
    
    return validTransitions[from]?.includes(to) || false;
  }

  /**
   * Gets human-readable description of status
   */
  getStatusDescription(status: ApplicationStatus): string {
    const descriptions: Record<ApplicationStatus, string> = {
      applied: 'Application submitted and pending response',
      interview: 'Interview scheduled or in progress',
      offer: 'Job offer received',
      rejected: 'Application was rejected',
      withdrawn: 'Application was withdrawn'
    };
    
    return descriptions[status] || 'Unknown status';
  }
}

export const aiStatusDetector = new AIStatusDetector();
