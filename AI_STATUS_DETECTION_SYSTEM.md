# AI-Powered Job Application Status Detection System

## Overview

The AI Status Detection System automatically analyzes job-related emails to determine the current status of job applications using a combination of rule-based detection and advanced AI analysis.

## Features Implemented

### 🧠 Hybrid AI Detection
- **Rule-based Detection**: Fast pattern matching for common status indicators
- **AI-Enhanced Analysis**: Google AI (Gemini) for sophisticated content understanding
- **Fallback Protection**: Always returns a result, even if AI fails

### 📊 Status Categories
The system detects five primary application statuses:

| Status | Description | Common Indicators |
|--------|-------------|-------------------|
| **applied** | Initial application submitted | "received your application", "thank you for applying" |
| **interview** | Interview scheduled/in progress | "schedule", "interview", "zoom", "teams", "next step" |
| **offer** | Job offer received | "offer", "congratulations", "compensation", "start date" |
| **rejected** | Application declined | "unfortunately", "not selected", "another candidate" |
| **withdrawn** | Application withdrawn | "withdraw", "no longer interested", "pursuing other" |

### 🌍 Multi-Language Support
- **English**: Full support for all common patterns
- **Hebrew**: Native support for Hebrew job-related terms
- **Mixed Content**: Handles emails with both languages

### 🎯 Advanced Analysis Features

#### Confidence Scoring
- **High Confidence (80%+)**: Green indicator, automatic processing recommended
- **Medium Confidence (60-80%)**: Yellow indicator, human review suggested  
- **Low Confidence (<60%)**: Red indicator, manual review required

#### Status Transition Validation
- Validates if detected status changes make logical sense
- Prevents invalid transitions (e.g., rejected → interview)
- Maintains application lifecycle integrity

#### Extracted Details
- **Interview Information**: Date, time, location, type (video/phone/in-person)
- **Rejection Details**: Reasons and feedback when available
- **Offer Information**: Salary, start date, compensation details
- **Next Steps**: Action items and follow-up requirements

## Implementation Components

### Core AI Status Detector (`src/lib/ai-status-detector.ts`)
```typescript
export class AIStatusDetector {
  async detectApplicationStatus(
    emailSubject: string,
    emailContent: string, 
    senderEmail: string,
    currentStatus?: ApplicationStatus
  ): Promise<StatusAnalysis>
}
```

### Enhanced Email Parser (`src/lib/emailParser.ts`)
```typescript
export async function parseEmailWithStatusDetection(
  emailSubject: string,
  emailContent: string,
  senderEmail: string,
  currentStatus?: ApplicationStatus
): Promise<EnhancedParsedEmailData>
```

### UI Integration (`src/components/EmailParserDialog.tsx`)
- Enhanced email parsing dialog with AI status display
- Real-time confidence indicators
- Status override capabilities
- Detailed AI reasoning display

## AI Analysis Process

### Stage 1: Rule-Based Detection
```typescript
// Fast pattern matching
const interviewPatterns = [
  'interview', 'ראיון', 'zoom', 'teams', 'schedule', 'invitation'
];

const rejectionPatterns = [
  'unfortunately', 'regret', 'not selected', 'לצערנו'
];
```

### Stage 2: AI Enhancement
```typescript
// Sophisticated AI analysis
const prompt = `
Analyze this email to determine job application status:
- Subject: ${subject}
- Content: ${content}
- Context: ${currentStatus}

Determine status from: applied, interview, offer, rejected, withdrawn
`;
```

### Stage 3: Result Combination
- Prefers AI results if confidence > 70%
- Falls back to rule-based detection for reliability
- Always validates status transitions

## Usage Examples

### Basic Status Detection
```typescript
import { aiStatusDetector } from '@/lib/ai-status-detector';

const analysis = await aiStatusDetector.detectApplicationStatus(
  "Interview Invitation - Senior Developer",
  "We would like to schedule an interview...",
  "hr@company.com"
);

console.log(analysis.detectedStatus); // 'interview'
console.log(analysis.confidence);    // 0.95
```

### Enhanced Email Parsing
```typescript
import { parseEmailWithStatusDetection } from '@/lib/emailParser';

const result = await parseEmailWithStatusDetection(
  "Thank you for your application",
  emailContent,
  "noreply@company.com"
);

console.log(result.detectedStatus);     // 'applied'
console.log(result.statusAnalysis);     // Full AI analysis
```

### Status Update Detection
```typescript
import { detectStatusFromEmail } from '@/lib/emailParser';

const update = await detectStatusFromEmail(
  "Unfortunately, we have decided...",
  emailContent,
  "hr@company.com",
  'interview' // current status
);

console.log(update.shouldUpdate);  // true
console.log(update.newStatus);     // 'rejected'
```

## Performance Optimizations

### Caching Strategy
- Rule-based results cached for identical content
- AI responses cached by content hash
- Reduces API calls and improves speed

### Hybrid Model Selection
- Uses Gemini Flash for simple status detection
- Falls back to Gemini Pro for complex analysis
- Optimizes cost and response time

### Error Handling
- Graceful degradation when AI is unavailable
- Automatic fallback to rule-based detection
- Never blocks user workflow

## Integration Points

### Email Processing Pipeline
1. **Gmail Sync** → Receives new emails
2. **Content Analysis** → Extracts basic information  
3. **Status Detection** → AI determines application status
4. **Validation** → Checks transition validity
5. **Update Application** → Modifies status if confident

### User Interface
- **Real-time Analysis**: Status detection as user types
- **Confidence Indicators**: Visual feedback on AI certainty
- **Manual Override**: User can correct AI decisions
- **Reasoning Display**: Shows why AI chose specific status

### Workflow Integration
- **Automatic Updates**: High-confidence status changes applied automatically
- **Review Queue**: Medium-confidence changes require approval
- **Audit Trail**: All AI decisions logged with reasoning

## Monitoring and Analytics

### Success Metrics
- **Detection Accuracy**: Percentage of correct status predictions
- **Confidence Calibration**: How well confidence scores match accuracy
- **User Override Rate**: How often users correct AI decisions
- **Processing Speed**: Time from email to status detection

### Logging
```typescript
console.log('AI Status Detection Result:', {
  subject: emailSubject.substring(0, 50) + '...',
  detectedStatus: statusAnalysis.detectedStatus,
  confidence: statusAnalysis.confidence,
  reasoning: statusAnalysis.reasoning
});
```

## Future Enhancements

### Planned Features
1. **Learning from Corrections**: Train on user overrides
2. **Company-Specific Patterns**: Learn email styles per company
3. **Calendar Integration**: Detect interview dates and add to calendar
4. **Notification System**: Alert on important status changes
5. **Batch Processing**: Analyze multiple emails simultaneously

### Advanced AI Features
1. **Sentiment Analysis**: Detect tone and urgency
2. **Entity Extraction**: Better company/position detection
3. **Timeline Reconstruction**: Build complete application history
4. **Predictive Analytics**: Forecast likely next steps

## Testing

### Validation Scenarios
- ✅ Interview invitations (English/Hebrew)
- ✅ Rejection emails (various tones)
- ✅ Job offers and negotiations
- ✅ Application confirmations
- ✅ Withdrawal notifications
- ✅ Follow-up requests
- ✅ Mixed language content

### Edge Cases Handled
- Automated vs. personal emails
- CC'd messages and forwards
- Ambiguous status changes
- Multiple applications same company
- Recruitment agency communications

The AI Status Detection System significantly improves the job application tracking experience by automatically maintaining accurate status information with minimal user intervention.
