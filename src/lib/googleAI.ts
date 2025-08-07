interface GoogleAIResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
    finishReason: string;
    index: number;
    safetyRatings: Array<{
      category: string;
      probability: string;
    }>;
  }>;
  promptFeedback: {
    safetyRatings: Array<{
      category: string;
      probability: string;
    }>;
  };
}

interface AIAnalysisResult {
  isJobRelated: boolean;
  confidence: number;
  reasoning: string;
  extractedData?: {
    company?: string;
    position?: string;
    contactEmail?: string;
    notes?: string;
  };
  modelUsed?: 'gemini-2.5-flash' | 'gemini-2.5-pro';
  processingTime?: number;
}

interface ModelConfig {
  name: 'gemini-2.5-flash' | 'gemini-2.5-pro';
  temperature: number;
  topK: number;
  topP: number;
  maxOutputTokens: number;
}

class GoogleAIService {
  private apiKey: string | null;
  private usageStats = {
    flashCalls: 0,
    proCalls: 0,
    totalTokens: 0
  };

  constructor() {
    this.apiKey = import.meta.env.VITE_GOOGLE_AI_API_KEY || null;
  }

  isConfigured(): boolean {
    return !!this.apiKey && this.apiKey !== 'your_google_ai_api_key_here';
  }

  /**
   * Determines which model to use based on email characteristics
   */
  private selectModel(subject: string, content: string, from: string, context?: {
    initialConfidence?: number;
    isInReviewQueue?: boolean;
    hasComplexContent?: boolean;
  }): ModelConfig {
    const emailText = `${subject} ${content}`.toLowerCase();
    
    // Check for complex content indicators
    const hasHebrewText = /[\u0590-\u05FF]/.test(emailText);
    const hasComplexStructure = content.length > 2000 || content.split('\n').length > 20;
    const hasMixedLanguages = hasHebrewText && /[a-zA-Z]/.test(emailText);
    const hasForwardedContent = emailText.includes('forwarded') || emailText.includes('fwd:');
    
    const complexityIndicators = [
      hasHebrewText,
      hasComplexStructure,
      hasMixedLanguages,
      hasForwardedContent,
      context?.hasComplexContent,
      context?.isInReviewQueue
    ].filter(Boolean).length;

    // Use Pro model for medium confidence or complex content
    const useProModel = 
      (context?.initialConfidence !== undefined && 
       context.initialConfidence >= 0.15 && 
       context.initialConfidence <= 0.85) ||
      complexityIndicators >= 2 ||
      context?.isInReviewQueue;

    if (useProModel) {
      return {
        name: 'gemini-2.5-pro',
        temperature: 0.05,
        topK: 1,
        topP: 0.9,
        maxOutputTokens: 2048
      };
    } else {
      return {
        name: 'gemini-2.5-flash',
        temperature: 0.1,
        topK: 1,
        topP: 1,
        maxOutputTokens: 1024
      };
    }
  }

  async analyzeEmail(
    subject: string, 
    content: string, 
    from: string, 
    context?: {
      initialConfidence?: number;
      isInReviewQueue?: boolean;
      hasComplexContent?: boolean;
    }
  ): Promise<AIAnalysisResult> {
    if (!this.isConfigured()) {
      console.warn('Google AI not configured, skipping AI analysis');
      return {
        isJobRelated: false,
        confidence: 0,
        reasoning: 'Google AI not configured'
      };
    }

    const startTime = Date.now();

    try {
      // Select appropriate model based on content complexity
      const modelConfig = this.selectModel(subject, content, from, context);
      
      // Build prompt (enhanced for Pro model if selected)
      const prompt = this.buildAnalysisPrompt(subject, content, from, modelConfig.name === 'gemini-2.5-pro');
      
      // Log model selection for monitoring
      console.log(`Using ${modelConfig.name} for email analysis`, {
        subject: subject.substring(0, 50),
        contentLength: content.length,
        hasContext: !!context,
        initialConfidence: context?.initialConfidence
      });

      // Make API call with selected model
      const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/${modelConfig.name}:generateContent?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: modelConfig.temperature,
            topK: modelConfig.topK,
            topP: modelConfig.topP,
            maxOutputTokens: modelConfig.maxOutputTokens,
          },
          safetySettings: [
            {
              category: "HARM_CATEGORY_HARASSMENT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
              category: "HARM_CATEGORY_HATE_SPEECH",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
              category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
              category: "HARM_CATEGORY_DANGEROUS_CONTENT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            }
          ]
        })
      });

      if (!response.ok) {
        // Try fallback to Flash model if Pro fails
        if (modelConfig.name === 'gemini-2.5-pro') {
          console.warn(`Pro model failed, falling back to Flash for email: ${subject.substring(0, 50)}`);
          return this.analyzeEmail(subject, content, from, { ...context, hasComplexContent: false });
        }
        throw new Error(`Google AI API error: ${response.status} ${response.statusText}`);
      }

      const data: GoogleAIResponse = await response.json();
      
      if (!data.candidates || data.candidates.length === 0) {
        throw new Error('No response from Google AI');
      }

      const responseText = data.candidates[0].content.parts[0].text;
      const processingTime = Date.now() - startTime;
      
      // Update usage statistics
      if (modelConfig.name === 'gemini-2.5-pro') {
        this.usageStats.proCalls++;
      } else {
        this.usageStats.flashCalls++;
      }
      this.usageStats.totalTokens += this.estimateTokens(prompt + responseText);

      const result = this.parseAIResponse(responseText);
      
      // Add metadata to result
      result.modelUsed = modelConfig.name;
      result.processingTime = processingTime;
      
      return result;

    } catch (error) {
      console.error('Error calling Google AI:', error);
      return {
        isJobRelated: false,
        confidence: 0,
        reasoning: `AI analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        modelUsed: 'gemini-2.5-flash', // Default fallback
        processingTime: Date.now() - startTime
      };
    }
  }

  private buildAnalysisPrompt(subject: string, content: string, from: string, useProModel: boolean = false): string {
    const basePrompt = `You are an expert email analyzer specialized in identifying job-related communications. Analyze the following email and determine if it's related to job applications, interviews, recruiting, or career opportunities.

IMPORTANT: Pay special attention to Hebrew text and job-related terms in both English and Hebrew.

Email Details:
Subject: ${subject}
From: ${from}
Content: ${content}

Please analyze this email and respond in the following JSON format:
{
  "isJobRelated": boolean,
  "confidence": number (0.0 to 1.0),
  "reasoning": "Brief explanation of your decision",
  "extractedData": {
    "company": "Company name if found",
    "position": "Job position if mentioned", 
    "contactEmail": "Contact email if different from sender",
    "recruiter": "Recruiter name if identified",
    "interviewer": "Interviewer name if this is an interview-related email",
    "notes": "Any relevant job-related details"
  }
}

Consider these as job-related indicators:
- Interview invitations (including "ראיון", "הראיון", "interview")
- Recruiting messages (including "גיוס", "מגייס", "recruiting", "recruiter")
- Job application confirmations
- Offer letters
- Career opportunity notifications
- Company outreach for positions
- Follow-up messages about applications
- Assessment or test invitations

Hebrew job-related terms to look for:
- ראיון, הראיון (interview)
- גיוס, הגיוס (recruitment)  
- מועמד, מועמדת (candidate)
- תפקיד, התפקיד (position/role)
- עמדה, העמדה (position)
- הצעה, ההצעה (offer)
- זימון, הזימון (invitation)
- מגייס, מגייסת (recruiter)

Exclude these types of emails:
- Newsletter subscriptions
- Training/webinar invitations
- General marketing emails
- Job board notifications (LinkedIn, Indeed, Glassdoor, etc. unless from specific companies)
- Career tips/advice emails (unless from a recruiter about a specific opportunity)
- LinkedIn connection requests or generic LinkedIn messages

IMPORTANT FOR LINKEDIN EMAILS:
When analyzing emails from LinkedIn (notifications, job alerts, etc.), DO NOT extract "LinkedIn" as the company name. 
Instead, look for the ACTUAL company mentioned in the email content that is hiring or posting the job.
For example:
- If email says "Google is hiring for Software Engineer", extract company: "Google", not "LinkedIn"
- If email says "New job at Microsoft posted on LinkedIn", extract company: "Microsoft", not "LinkedIn"
LinkedIn is just the platform/notification service, not the employer.

INTERVIEWER EXTRACTION GUIDELINES:
For interview-related emails, carefully extract the interviewer's name using these patterns:
- "Interview with [Name]" or "ראיון עם [שם]"
- "You will be interviewing with [Name]"
- "Your interviewer will be [Name]" 
- "Meeting with [Name]" (if in interview context)
- Names mentioned in email signatures for interview emails
- From field sender name (if it's an interview invitation)

Exclude generic terms like "HR Team", "Interview Panel", "Committee", etc.
Look for actual human names, both in English and Hebrew.

RECRUITER VS INTERVIEWER DISTINCTION:
- Recruiter: Person who contacted you about the opportunity, handles initial screening
- Interviewer: Specific person who will conduct the technical/final interview
- The same person can be both, but prioritize their role based on email context

Respond only with valid JSON, no additional text.`;

    // Enhanced prompt for Pro model with additional reasoning instructions
    if (useProModel) {
      return basePrompt + `

ENHANCED ANALYSIS (Pro Model):
1. Apply deeper contextual understanding for ambiguous cases
2. Consider cultural context for Hebrew job market communications
3. Evaluate confidence with higher precision (use 0.1 increments)
4. Provide more detailed reasoning for borderline cases
5. Extract additional metadata when possible (salary, location, etc.)`;
    }

    return basePrompt;
  }

  private parseAIResponse(responseText: string): AIAnalysisResult {
    try {
      // Clean up the response text and try to extract JSON
      let cleanedResponse = responseText.trim();
      
      // Remove any markdown code blocks
      cleanedResponse = cleanedResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      
      // Try to find JSON in the response
      const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanedResponse = jsonMatch[0];
      }

      const parsed = JSON.parse(cleanedResponse);
      
      return {
        isJobRelated: !!parsed.isJobRelated,
        confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0)),
        reasoning: parsed.reasoning || 'No reasoning provided',
        extractedData: parsed.extractedData || {}
      };
    } catch (error) {
      console.error('Error parsing AI response:', error, 'Response:', responseText);
      return {
        isJobRelated: false,
        confidence: 0,
        reasoning: 'Failed to parse AI response'
      };
    }
  }

  /**
   * Estimates token count for usage tracking
   */
  private estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token for mixed English/Hebrew text
    return Math.ceil(text.length / 4);
  }

  /**
   * Gets current usage statistics
   */
  getUsageStats() {
    return {
      ...this.usageStats,
      flashToProRatio: this.usageStats.flashCalls / Math.max(1, this.usageStats.proCalls),
      totalCalls: this.usageStats.flashCalls + this.usageStats.proCalls,
      estimatedCost: this.calculateEstimatedCost()
    };
  }

  /**
   * Calculates estimated cost based on usage
   */
  private calculateEstimatedCost(): { flash: number; pro: number; total: number } {
    // Pricing per 1M tokens: Flash $0.35, Pro $7.00
    const totalCalls = this.usageStats.flashCalls + this.usageStats.proCalls;
    const flashTokens = this.usageStats.totalTokens * this.usageStats.flashCalls / Math.max(1, totalCalls);
    const proTokens = this.usageStats.totalTokens * this.usageStats.proCalls / Math.max(1, totalCalls);
    
    const flashCost = flashTokens * 0.35 / 1000000;
    const proCost = proTokens * 7.00 / 1000000;
    
    return {
      flash: flashCost,
      pro: proCost,
      total: flashCost + proCost
    };
  }

  /**
   * Resets usage statistics
   */
  resetUsageStats() {
    this.usageStats = {
      flashCalls: 0,
      proCalls: 0,
      totalTokens: 0
    };
  }
}

export const googleAI = new GoogleAIService();
