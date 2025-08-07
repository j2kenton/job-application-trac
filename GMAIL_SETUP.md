# Gmail Integration Setup Guide

This guide will help you set up Gmail integration for automatic job application email processing.

## Features

- **Automatic Email Sync**: Daily sync at 9:00 AM Israel time
- **AI-Powered Processing**: Extracts job application data using AI
- **Smart Filtering**: Configurable filters to identify relevant emails
- **Review Queue**: Manual review for uncertain extractions (25-75% confidence)
- **Auto-Processing**: High confidence emails (75%+) are automatically added
- **Duplicate Prevention**: Avoids adding duplicate applications
- **Email Labeling**: Adds "_interviews_tracked" label to processed emails

## Prerequisites

1. **Google Cloud Project**: You need a Google Cloud project with Gmail API enabled
2. **OAuth 2.0 Credentials**: Client ID for web application
3. **Environment Variables**: Configure your Google Client ID

## Step 1: Google Cloud Setup

### 1.1 Create/Select Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Note your project ID

### 1.2 Enable Gmail API
1. Go to APIs & Services > Library
2. Search for "Gmail API"
3. Click "Enable"

### 1.3 Create OAuth 2.0 Credentials
1. Go to APIs & Services > Credentials
2. Click "Create Credentials" > "OAuth 2.0 Client IDs"
3. Choose "Web application"
4. Add authorized origins:
   - `http://localhost:5173` (for development)
   - Your production domain (e.g., `https://yourapp.com`)
5. Copy the Client ID

## Step 2: Local Setup

### 2.1 Environment Configuration
1. Copy the example environment file:
   ```bash
   cp .env.local.example .env.local
   ```

2. Edit `.env.local` and add your Google Client ID:
   ```
   VITE_GOOGLE_CLIENT_ID=your_actual_client_id_here
   ```

### 2.2 Install Dependencies
```bash
npm install
```

### 2.3 Start Development Server
```bash
npm run dev
```

## Step 3: Configuration

### 3.1 Gmail Filters (`src/config/gmail-filters.json`)

Configure which emails to process:

```json
{
  "includeKeywords": [
    "application", "interview", "position", "job", 
    "hiring", "candidate", "opportunity"
  ],
  "excludeKeywords": [
    "webinar", "newsletter", "training", "course",
    "marketing", "promotion", "advertisement"
  ],
  "excludeJobBoards": [
    "noreply@indeed.com",
  ],
  "confidenceThresholds": {
    "autoProcess": 0.75,
    "reviewQueue": 0.25
  },
  "trackingLabel": "_interviews_tracked",
  "contextExclusions": [
    "unsubscribe", "this is an automated message",
    "do not reply to this email"
  ]
}
```

### 3.2 Sync Settings (`src/config/sync-settings.json`)

Configure sync behavior:

```json
{
  "processing": {
    "lookbackDays": 30,
    "maxEmailsPerSync": 50,
    "processThreadsOnly": "latest"
  },
  "schedule": {
    "dailySyncTime": "09:00",
    "timezone": "Asia/Jerusalem"
  }
}
```

## Step 4: Using the Integration

### 4.1 Connect Gmail Account
1. Open the app and go to "Gmail Setup" tab
2. Click "Connect Gmail Account"
3. Allow popups if blocked
4. Sign in to your Google account
5. Grant necessary permissions

### 4.2 Manual Sync
- Go to "Sync Status" tab
- Click "Sync Now" to manually trigger email processing

### 4.3 Review Queue
- Go to "Review Queue" tab
- Review emails with 25-75% confidence
- Approve or reject suggested applications

## Email Processing Logic

### Confidence Scoring
The system assigns confidence scores based on:
- **Company and Position Found**: +40% or +20%
- **Job Keywords**: Up to +30%
- **Additional Data**: +10% each for contact email, job URL, salary
- **Exclusion Keywords**: -20% each
- **Context Exclusions**: -30% each

### Processing Actions
- **75%+ Confidence**: Auto-added to applications
- **25-75% Confidence**: Added to review queue
- **<25% Confidence**: Discarded

### Extracted Data
The AI attempts to extract:
- Company name
- Job position/title
- Application date
- Status (applied, interview, offer, rejected)
- Contact email
- Job URL
- Salary information
- Additional notes

## Troubleshooting

### Common Issues

1. **"Popup blocked" error**
   - Allow popups for your domain
   - Try again after allowing popups

2. **"Client ID not configured" error**
   - Check your `.env.local` file
   - Ensure `VITE_GOOGLE_CLIENT_ID` is set correctly
   - Restart the development server

3. **Authentication fails**
   - Check OAuth 2.0 settings in Google Cloud Console
   - Ensure your domain is in authorized origins
   - Clear browser cache and try again

4. **No emails found**
   - Check your filter configuration
   - Adjust `lookbackDays` in sync settings
   - Verify you have relevant emails in the time period

5. **Low confidence scores**
   - Review and adjust filter keywords
   - Check for exclusion keywords in your emails
   - Consider adjusting confidence thresholds

### Debug Mode
Check browser console for detailed error messages and sync information.

## Security Notes

- OAuth tokens are stored securely in browser localStorage
- Only read-only Gmail permissions are requested
- No email content is stored permanently
- Labels are added non-destructively

## Privacy

- Email content is processed locally and with AI for extraction only
- No personal data is transmitted to third parties
- You can disconnect and remove permissions at any time

## Support

If you encounter issues:
1. Check this guide thoroughly
2. Review browser console for errors
3. Verify Google Cloud Console settings
4. Ensure all environment variables are set correctly

For additional help, refer to the main project documentation.
