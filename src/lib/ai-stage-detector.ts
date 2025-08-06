import { googleAI } from './googleAI';
import { ProcessedEmail } from './gmail/GmailService';

export type ProcessingStage = 
  | 'initial' 
  | 'manual_review' 
  | 'ai_enhanced' 
  | 'auto_processed' 
  | 'rejected' 
  | 'pending_review'
  | 'completed';

export interface StageAnalysis {
  currentStage: ProcessingStage;
  confidence: number;
  reasoning: string;
  suggestedNextAction: string;
  stageHistory: ProcessingStage[];
  indicators: {
    hasJobKeywords: boolean;
    hasCompanyInfo: boolean;
    hasPositionInfo: boolean;
    hasApplicationContext: boolean;
    confidenceLevel: 'high' | 'medium' | 'low';
    aiProcessed: boolean;
    manuallyReviewed: boolean;
  };
}

class AIStageDetector {
  /**
   * Analyzes an email to determine its current processing stage using AI
   */
  async detectProcessingStage(email: ProcessedEmail, additionalContext?: {
    isInReviewQueue?: boolean;
    hasBeenProcessed?: boolean;
    previousStages?: ProcessingStage[];
  }): Promise<StageAnalysis> {
    
    const indicators = this.analyzeEmailIndicators(email);
    const context = additionalContext || {};
    
    // Use AI to get sophisticated stage analysis
    let aiAnalysis: any = null;
    if (googleAI.isConfigured()) {
      try {
        aiAnalysis = await this.getAIStageAnalysis(email, indicators, context);
      } catch (error) {
        console.warn('AI stage analysis failed, falling back to rule-based detection:', error);
      }
    }
    
    // Combine AI analysis with rule-based detection
    const stageAnalysis = this.combineAnalyses(email, indicators, context, aiAnalysis);
    
    return stageAnalysis;
  }

  /**
   * Analyzes email for various indicators that help determine processing stage
   */
  private analyzeEmailIndicators(email: ProcessedEmail): StageAnalysis['indicators'] {
    const content = email.content.toLowerCase();
    const subject = email.subject.toLowerCase();
    const notes = email.extractedData.notes?.toLowerCase() || '';
    
    // Check for job-related keywords
    const jobKeywords = [
      'interview', 'position', 'role', 'application', 'candidate', 'hire', 'offer', 
      'recruiting', 'recruiter', 'recruit', 'invitation', 'job', 'career',
      'ראיון', 'הראיון', 'עמדה', 'העמדה', 'תפקיד', 'התפקיד', 'בקשה', 'הבקשה',
      'מועמד', 'המועמד', 'גיוס', 'הגיוס', 'מגייס', 'המגייס', 'זימון', 'הזימון'
    ];
    
    const hasJobKeywords = jobKeywords.some(keyword => 
      content.includes(keyword) || subject.includes(keyword)
    );
    
    // Check for company information
    const hasCompanyInfo = !!(
      email.extractedData.company || 
      email.from.includes('@') ||
      content.includes('company') ||
      content.includes('organization')
    );
    
    // Check for position information
    const hasPositionInfo = !!(
      email.extractedData.position ||
      content.includes('position') ||
      content.includes('role') ||
      subject.includes('position') ||
      subject.includes('role')
    );
    
    // Check for application context
    const applicationKeywords = ['application', 'apply', 'applied', 'candidate', 'candidacy'];
    const hasApplicationContext = applicationKeywords.some(keyword => 
      content.includes(keyword) || subject.includes(keyword)
    );
    
    // Determine confidence level
    let confidenceLevel: 'high' | 'medium' | 'low' = 'low';
    if (email.confidence >= 0.85) {
      confidenceLevel = 'high';
    } else if (email.confidence >= 0.25) {
      confidenceLevel = 'medium';
    }
    
    // Check if AI processed
    const aiProcessed = notes.includes('ai analysis') || notes.includes('ai boosted');
    
    // Check if manually reviewed (would need to be tracked separately in real implementation)
    const manuallyReviewed = notes.includes('manually reviewed') || notes.includes('human reviewed');
    
    return {
      hasJobKeywords,
      hasCompanyInfo,
      hasPositionInfo,
      hasApplicationContext,
      confidenceLevel,
      aiProcessed,
      manuallyReviewed
    };
  }

  /**
   * Uses Google AI to get sophisticated stage analysis
   */
  private async getAIStageAnalysis(
    email: ProcessedEmail, 
    indicators: StageAnalysis['indicators'],
    context: any
  ): Promise<any> {
    const prompt = `
Analyze this email to determine its current processing stage in a job application tracking system.

Email Details:
- Subject: ${email.subject}
- From: ${email.from}
- Confidence: ${Math.round(email.confidence * 100)}%
- Content Preview: ${email.content.substring(0, 300)}...

Extracted Data:
- Company: ${email.extractedData.company || 'Not found'}
- Position: ${email.extractedData.position || 'Not found'}
- Contact Email: ${email.extractedData.contactEmail || 'Not found'}
- Job URL: ${email.extractedData.jobUrl || 'Not found'}

Current Indicators:
- Has job keywords: ${indicators.hasJobKeywords}
- Has company info: ${indicators.hasCompanyInfo}
- Has position info: ${indicators.hasPositionInfo}
- Has application context: ${indicators.hasApplicationContext}
- Confidence level: ${indicators.confidenceLevel}
- AI processed: ${indicators.aiProcessed}
- Manually reviewed: ${indicators.manuallyReviewed}

Additional Context:
- In review queue: ${context.isInReviewQueue || false}
- Has been processed: ${context.hasBeenProcessed || false}
- Previous stages: ${context.previousStages?.join(', ') || 'None'}

Processing Stages Available:
1. initial - Email just received, no processing yet
2. manual_review - Needs human review (25-84% confidence)
3. ai_enhanced - Processed by AI to boost confidence
4. auto_processed - High confidence (85%+), automatically processed
5. rejected - Low confidence (<25%), rejected from system
6. pending_review - Waiting in review queue for human decision
7. completed - Successfully processed and added to job tracker

Based on all this information, determine:
1. What stage is this email currently at?
2. What should be the next action?
3. What's the reasoning behind this assessment?

Respond with JSON format:
{
  "currentStage": "stage_name",
  "reasoning": "explanation of why this stage was chosen",
  "suggestedNextAction": "what should happen next",
  "stageConfidence": 0.95
}
    `;

    try {
      // Use the analyzeEmail method with context for hybrid model selection
      const result = await googleAI.analyzeEmail(
        `Stage Analysis: ${email.subject}`,
        prompt,
        email.from,
        {
          initialConfidence: email.confidence,
          isInReviewQueue: context.isInReviewQueue,
          hasComplexContent: true // Stage analysis is always complex
        }
      );
      
      // Transform the result to match our expected format
      return {
        currentStage: this.inferStageFromAIResult(result, email, context),
        reasoning: result.reasoning,
        suggestedNextAction: this.getSuggestedAction(result, email, context),
        stageConfidence: result.confidence,
        modelUsed: result.modelUsed,
        processingTime: result.processingTime
      };
    } catch (error) {
      console.error('Failed to get AI stage analysis:', error);
      return null;
    }
  }

  /**
   * Combines AI analysis with rule-based detection for final stage determination
   */
  private combineAnalyses(
    email: ProcessedEmail,
    indicators: StageAnalysis['indicators'],
    context: any,
    aiAnalysis: any
  ): StageAnalysis {
    
    // Rule-based stage detection as fallback
    let currentStage: ProcessingStage = 'initial';
    let reasoning = 'Email received and awaiting initial processing';
    let suggestedNextAction = 'Begin confidence analysis';
    
    // Apply rule-based logic
    if (context.isInReviewQueue) {
      currentStage = 'pending_review';
      reasoning = 'Email is currently in the review queue awaiting human decision';
      suggestedNextAction = 'Human reviewer should approve or reject this email';
    } else if (email.confidence >= 0.85) {
      currentStage = 'auto_processed';
      reasoning = `High confidence (${Math.round(email.confidence * 100)}%) allows automatic processing`;
      suggestedNextAction = 'Email should be automatically added to job tracker';
    } else if (email.confidence >= 0.25) {
      currentStage = 'manual_review';
      reasoning = `Medium confidence (${Math.round(email.confidence * 100)}%) requires human review`;
      suggestedNextAction = 'Add to review queue for human evaluation';
    } else if (indicators.aiProcessed) {
      currentStage = 'rejected';
      reasoning = 'Email was processed by AI but still has low confidence';
      suggestedNextAction = 'Email should be rejected from the system';
    } else if (email.confidence < 0.25) {
      currentStage = 'ai_enhanced';
      reasoning = 'Low confidence requires AI enhancement before final decision';
      suggestedNextAction = 'Process with AI to attempt confidence boost';
    }
    
    // Override with AI analysis if available and confident
    if (aiAnalysis && aiAnalysis.stageConfidence > 0.8) {
      currentStage = aiAnalysis.currentStage as ProcessingStage;
      reasoning = aiAnalysis.reasoning;
      suggestedNextAction = aiAnalysis.suggestedNextAction;
    }
    
    // Build stage history (simplified for now)
    const stageHistory: ProcessingStage[] = context.previousStages || [];
    if (!stageHistory.includes(currentStage)) {
      stageHistory.push(currentStage);
    }
    
    return {
      currentStage,
      confidence: aiAnalysis?.stageConfidence || this.calculateRuleBasedConfidence(indicators),
      reasoning,
      suggestedNextAction,
      stageHistory,
      indicators
    };
  }

  /**
   * Calculates confidence in stage detection based on rule-based indicators
   */
  private calculateRuleBasedConfidence(indicators: StageAnalysis['indicators']): number {
    let confidence = 0.5; // Base confidence
    
    if (indicators.hasJobKeywords) confidence += 0.15;
    if (indicators.hasCompanyInfo) confidence += 0.1;
    if (indicators.hasPositionInfo) confidence += 0.1;
    if (indicators.hasApplicationContext) confidence += 0.15;
    
    // Confidence level affects our certainty about the stage
    switch (indicators.confidenceLevel) {
      case 'high': confidence += 0.2; break;
      case 'medium': confidence += 0.1; break;
      case 'low': confidence -= 0.1; break;
    }
    
    return Math.max(0.3, Math.min(1.0, confidence));
  }

  /**
   * Gets a human-readable description of the current processing stage
   */
  getStageDescription(stage: ProcessingStage): string {
    const descriptions: Record<ProcessingStage, string> = {
      initial: 'Email has been received and is awaiting initial processing',
      manual_review: 'Email has medium confidence and requires human review',
      ai_enhanced: 'Email is being processed by AI to boost confidence',
      auto_processed: 'Email has high confidence and is being automatically processed',
      rejected: 'Email has been rejected due to low confidence',
      pending_review: 'Email is in the review queue awaiting human decision',
      completed: 'Email has been successfully processed and added to the job tracker'
    };
    
    return descriptions[stage] || 'Unknown processing stage';
  }

  /**
   * Gets the next possible stages from the current stage
   */
  getNextPossibleStages(currentStage: ProcessingStage): ProcessingStage[] {
    const transitions: Record<ProcessingStage, ProcessingStage[]> = {
      initial: ['manual_review', 'ai_enhanced', 'auto_processed', 'rejected'],
      manual_review: ['pending_review', 'ai_enhanced'],
      ai_enhanced: ['auto_processed', 'manual_review', 'rejected'],
      auto_processed: ['completed'],
      rejected: [], // Terminal state
      pending_review: ['completed', 'rejected'],
      completed: [] // Terminal state
    };
    
    return transitions[currentStage] || [];
  }

  /**
   * Infers the processing stage from AI analysis result
   */
  private inferStageFromAIResult(aiResult: any, email: ProcessedEmail, context: any): ProcessingStage {
    // Since the AI analyzeEmail method doesn't return stage directly, 
    // we infer it from the confidence and job relatedness
    if (!aiResult.isJobRelated) {
      return 'rejected';
    }
    
    if (context.isInReviewQueue) {
      return 'pending_review';
    }
    
    if (aiResult.confidence >= 0.85) {
      return 'auto_processed';
    } else if (aiResult.confidence >= 0.25) {
      return 'manual_review';
    } else {
      return 'rejected';
    }
  }

  /**
   * Gets suggested action based on AI result and email state
   */
  private getSuggestedAction(aiResult: any, email: ProcessedEmail, context: any): string {
    if (!aiResult.isJobRelated) {
      return 'Email should be rejected as it is not job-related';
    }
    
    if (context.isInReviewQueue) {
      return 'Human reviewer should make a decision on this email';
    }
    
    if (aiResult.confidence >= 0.85) {
      return 'Email should be automatically processed and added to job tracker';
    } else if (aiResult.confidence >= 0.25) {
      return 'Email should be added to review queue for human evaluation';
    } else {
      return 'Email should be rejected due to low confidence';
    }
  }
}

export const aiStageDetector = new AIStageDetector();
