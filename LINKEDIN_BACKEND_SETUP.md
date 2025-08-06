# LinkedIn Backend Service Setup

LinkedIn OAuth requires a backend service for token exchange due to CORS security restrictions. This guide explains how to set up a simple backend to complete the LinkedIn integration.

## Why Backend is Required

LinkedIn's OAuth flow requires exchanging an authorization code for an access token, but this exchange must include the client secret, which cannot be safely stored in frontend applications. Additionally, LinkedIn's token endpoint doesn't allow CORS requests from browsers.

## Simple Backend Implementation

Here's a minimal Node.js/Express backend to handle LinkedIn OAuth:

### 1. Create Backend Service

```javascript
// server.js
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// LinkedIn token exchange endpoint
app.post('/api/linkedin/token', async (req, res) => {
  try {
    const { code, redirect_uri } = req.body;
    
    const response = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirect_uri,
        client_id: process.env.LINKEDIN_CLIENT_ID,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      return res.status(400).json({ error: data.error_description || 'Token exchange failed' });
    }

    res.json(data);
  } catch (error) {
    console.error('LinkedIn token exchange error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`LinkedIn backend service running on port ${PORT}`);
});
```

### 2. Package.json

```json
{
  "name": "linkedin-backend",
  "version": "1.0.0",
  "dependencies": {
    "express": "^4.18.0",
    "cors": "^2.8.5",
    "node-fetch": "^2.6.7",
    "dotenv": "^16.0.0"
  },
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  }
}
```

### 3. Environment Variables (.env)

```
LINKEDIN_CLIENT_ID=your_linkedin_client_id
LINKEDIN_CLIENT_SECRET=your_linkedin_client_secret
PORT=3001
```

### 4. Update Frontend Service

Update the `exchangeCodeForToken` method in `LinkedInService.ts`:

```typescript
private async exchangeCodeForToken(code: string): Promise<any> {
  const response = await fetch('http://localhost:3001/api/linkedin/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      code: code,
      redirect_uri: this.redirectUri
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to exchange code for token');
  }

  return response.json();
}
```

## Alternative Solutions

### 1. Serverless Functions

Deploy the token exchange as a serverless function:

**Vercel (api/linkedin/token.js):**
```javascript
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Same token exchange logic as above
}
```

**Netlify Functions (.netlify/functions/linkedin-token.js):**
```javascript
exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // Same token exchange logic as above
}
```

### 2. Backend-as-a-Service

Use services like:
- **Supabase Edge Functions**
- **Firebase Cloud Functions**
- **AWS Lambda**

## Security Considerations

1. **Environment Variables**: Never expose client secret in frontend
2. **CORS Configuration**: Restrict origins to your domain
3. **Rate Limiting**: Implement rate limiting on the token endpoint
4. **HTTPS**: Use HTTPS in production
5. **Token Storage**: Consider secure token storage options

## Current Implementation

The current frontend implementation:
- ✅ Handles OAuth flow correctly
- ✅ Opens LinkedIn auth in popup
- ✅ Receives authorization code
- ❌ Cannot exchange code for token (requires backend)

With the backend service, the LinkedIn integration will be fully functional for:
- User profile access
- Company data enhancement
- Professional network insights

## Next Steps

1. Set up the backend service
2. Update the frontend `exchangeCodeForToken` method
3. Test the complete OAuth flow
4. Deploy both frontend and backend to production
