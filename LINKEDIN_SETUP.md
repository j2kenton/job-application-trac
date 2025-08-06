# LinkedIn Integration Setup Guide

## Overview

This guide will help you set up LinkedIn integration for your job application tracker. The integration provides:

- **Company data enhancement** - Auto-fill company information
- **Professional networking** - Access your LinkedIn connections
- **Company insights** - Get detailed company information
- **Profile integration** - Connect your professional identity

**Important Note**: LinkedIn's API doesn't provide direct access to job applications due to privacy restrictions. This integration focuses on enhancing your existing job tracking with LinkedIn data.

## Step 1: Create LinkedIn Developer Application

### 1.1 Go to LinkedIn Developers
1. Visit [LinkedIn Developers](https://www.linkedin.com/developers/)
2. Sign in with your LinkedIn account
3. Click "Create app"

### 1.2 Fill Application Details
- **App name**: Job Application Tracker
- **LinkedIn Page**: Your personal LinkedIn page or company page
- **Privacy policy URL**: `https://your-domain.com/privacy` (optional for development)
- **App logo**: Upload a logo (optional)
- **Legal agreement**: Accept LinkedIn's terms

### 1.3 Configure Products
Enable these LinkedIn products:
- ✅ **Sign In with LinkedIn using OpenID Connect**
- ✅ **Share on LinkedIn** (if you want to share job updates)
- ⚠️ **Marketing Developer Platform** (may require approval)

## Step 2: Configure OAuth Settings

### 2.1 Authorized Redirect URLs
Add these URLs to your app's OAuth 2.0 settings:

**For Development:**
```
http://localhost:5173/linkedin/callback
http://localhost:3000/linkedin/callback
http://127.0.0.1:5173/linkedin/callback
```

**For Production:**
```
https://your-domain.com/linkedin/callback
https://your-app.netlify.app/linkedin/callback
https://your-app.vercel.app/linkedin/callback
```

### 2.2 OAuth 2.0 Scopes
Request these permissions:
- `r_liteprofile` - Basic profile information
- `r_emailaddress` - Email address
- `w_member_social` - Share content (optional)

## Step 3: Get Your Credentials

### 3.1 Client ID and Secret
1. Go to the "Auth" tab in your LinkedIn app
2. Copy the **Client ID**
3. Copy the **Client Secret**
4. Keep these secure - never commit them to version control

### 3.2 Test Your Settings
1. Verify all redirect URLs are correct
2. Check that required products are enabled
3. Ensure OAuth scopes are properly configured

## Step 4: Configure Your Application

### 4.1 Environment Variables
Create a `.env.local` file (copy from `.env.local.example`):

```env
# LinkedIn Integration
VITE_LINKEDIN_CLIENT_ID=your_actual_client_id_here
VITE_LINKEDIN_CLIENT_SECRET=your_actual_client_secret_here
VITE_LINKEDIN_REDIRECT_URI=http://localhost:5173/linkedin/callback
```

### 4.2 Security Considerations
- **Never expose Client Secret** in frontend code
- **Use HTTPS in production** for OAuth flows
- **Validate redirect URIs** to prevent OAuth attacks
- **Store tokens securely** (they're stored in localStorage for this demo)

## Step 5: Integration Features

### 5.1 What Works
✅ **LinkedIn Authentication** - OAuth 2.0 login flow
✅ **Profile Information** - Name, email, profile picture
✅ **Company Search** - Find companies by name
✅ **Professional Network** - Access to connections (with permissions)
✅ **Company Details** - Industry, size, location data

### 5.2 What Doesn't Work
❌ **Direct Job Applications** - LinkedIn API doesn't provide this
❌ **Job Search Results** - Limited API access to job postings
❌ **Application Status** - No API for tracking application status
❌ **Messages/InMail** - Requires special permissions

### 5.3 Workarounds
For job applications, consider:
1. **Manual Import** - Copy/paste job details from LinkedIn
2. **Browser Extension** - Scrape data with user permission
3. **Email Integration** - Parse LinkedIn job alert emails
4. **Chrome Extension** - Inject tracking into LinkedIn pages

## Step 6: Testing the Integration

### 6.1 Development Testing
1. Start your development server: `npm run dev`
2. Navigate to the LinkedIn integration section
3. Click "Connect LinkedIn"
4. Complete OAuth flow
5. Verify profile information appears

### 6.2 Common Issues

**"Invalid Redirect URI"**
- Check that your redirect URI exactly matches what's configured in LinkedIn
- Ensure no trailing slashes or extra parameters

**"Invalid Client ID"**
- Verify the Client ID is correctly copied
- Check that the app is not in development restrictions

**"Insufficient Permissions"**
- Ensure required products are enabled in LinkedIn app
- Check that OAuth scopes match your app configuration

**CORS Errors**
- LinkedIn API calls must go through your backend in production
- Use a proxy or backend service for API requests

## Step 7: Production Deployment

### 7.1 Backend Proxy (Recommended)
For production, implement a backend proxy for LinkedIn API calls:

```javascript
// Example backend endpoint
app.post('/api/linkedin/token', async (req, res) => {
  const { code } = req.body;
  
  const response = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.LINKEDIN_REDIRECT_URI,
      client_id: process.env.LINKEDIN_CLIENT_ID,
      client_secret: process.env.LINKEDIN_CLIENT_SECRET
    })
  });
  
  res.json(await response.json());
});
```

### 7.2 Environment Variables
Set these in your production environment:
```env
LINKEDIN_CLIENT_ID=your_client_id
LINKEDIN_CLIENT_SECRET=your_client_secret
LINKEDIN_REDIRECT_URI=https://your-domain.com/linkedin/callback
```

## Step 8: Advanced Features

### 8.1 Company Data Enhancement
When users add a job application, automatically:
1. Search LinkedIn for the company
2. Fill in company details (industry, size, location)
3. Add company logo and description
4. Show employee connections if available

### 8.2 Professional Network
Help users leverage their network:
1. Show connections at target companies
2. Suggest warm introductions
3. Track referral opportunities
4. Monitor company updates

### 8.3 Content Sharing
Allow users to share job search updates:
1. Celebrate new job offers
2. Share interview experiences
3. Ask for referrals
4. Update professional status

## Troubleshooting

### Common LinkedIn API Limitations
- **Rate Limits**: 500 requests per user per day
- **Data Access**: Limited to public information
- **Job Data**: No direct access to application data
- **Messaging**: Requires special partner access

### Alternative Approaches
If LinkedIn API is too restrictive:
1. **Browser Automation**: Use Puppeteer/Playwright
2. **Chrome Extension**: Inject tracking scripts
3. **Email Parsing**: Process LinkedIn job alert emails
4. **Manual Entry**: Enhanced forms with LinkedIn data

## Security Best Practices

1. **Token Storage**: Use secure storage (HTTP-only cookies in production)
2. **HTTPS Only**: Never use LinkedIn OAuth over HTTP in production
3. **State Validation**: Always validate OAuth state parameters
4. **Token Refresh**: Implement token refresh logic
5. **Scope Minimization**: Only request necessary permissions

## Next Steps

After setup:
1. Test the authentication flow
2. Implement company data enhancement
3. Add professional network features
4. Consider alternative data sources
5. Monitor API usage and limits

The LinkedIn integration enhances your job tracker with professional network data while respecting LinkedIn's API limitations and user privacy.
