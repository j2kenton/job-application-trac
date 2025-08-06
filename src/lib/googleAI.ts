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
}

class GoogleAIService {
  private apiKey: string | null;

  constructor() {
    this.apiKey = import.meta.env.VITE_GOOGLE_AI_API_KEY || null;
  }

  isConfigured(): boolean {
    return !!this.apiKey && this.apiKey !== 'your_google_ai_api_key_here';
  }

  async analyzeEmail(subject: string, content: string, from: string): Promise<AIAnalysisResult> {
    if (!this.isConfigured()) {
      console.warn('Google AI not configured, skipping AI analysis');
      return {
        isJobRelated: false,
        confidence: 0,
        reasoning: 'Google AI not configured'
      };
    }

    try {
      const prompt = this.buildAnalysisPrompt(subject, content, from);
      
      const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${this.apiKey}`, {
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
            temperature: 0.1,
            topK: 1,
            topP: 1,
            maxOutputTokens: 1024,
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
        throw new Error(`Google AI API error: ${response.status} ${response.statusText}`);
      }

      const data: GoogleAIResponse = await response.json();
      
      if (!data.candidates || data.candidates.length === 0) {
        throw new Error('No response from Google AI');
      }

      const responseText = data.candidates[0].content.parts[0].text;
      return this.parseAIResponse(responseText);

    } catch (error) {
      console.error('Error calling Google AI:', error);
      return {
        isJobRelated: false,
        confidence: 0,
        reasoning: `AI analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private buildAnalysisPrompt(subject: string, content: string, from: string): string {
    return `You are an expert email analyzer specialized in identifying job-related communications. Analyze the following email and determine if it's related to job applications, interviews, recruiting, or career opportunities.

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
- Job board notifications (unless from specific companies)
- Career tips/advice emails (unless from a recruiter about a specific opportunity)

Respond only with valid JSON, no additional text.`;
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
}

export const googleAI = new GoogleAIService();
