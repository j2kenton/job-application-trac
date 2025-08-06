import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());

// CORS configuration for multiple frontend ports
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
  'http://localhost:5173',
  'http://localhost:5174', 
  'http://localhost:5175',
  'http://localhost:3000'
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
    return callback(new Error(msg), false);
  },
  credentials: true
}));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    service: 'LinkedIn Backend',
    timestamp: new Date().toISOString(),
    port: PORT
  });
});

// LinkedIn OAuth token exchange endpoint
app.post('/api/linkedin/token', async (req, res) => {
  try {
    const { code, redirect_uri } = req.body;
    
    // Validate required parameters
    if (!code) {
      return res.status(400).json({ 
        error: 'Missing required parameter: code' 
      });
    }
    
    if (!redirect_uri) {
      return res.status(400).json({ 
        error: 'Missing required parameter: redirect_uri' 
      });
    }

    // Validate environment variables
    if (!process.env.LINKEDIN_CLIENT_ID || !process.env.LINKEDIN_CLIENT_SECRET) {
      console.error('Missing LinkedIn OAuth credentials in environment');
      return res.status(500).json({ 
        error: 'Server configuration error' 
      });
    }

    console.log('LinkedIn token exchange request:', {
      code: code.substring(0, 20) + '...',
      redirect_uri,
      timestamp: new Date().toISOString()
    });

    // Exchange authorization code for access token
    const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirect_uri,
        client_id: process.env.LINKEDIN_CLIENT_ID,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET
      })
    });

    const tokenData = await tokenResponse.json();
    
    if (!tokenResponse.ok) {
      console.error('LinkedIn token exchange failed:', {
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        error: tokenData
      });
      
      return res.status(400).json({ 
        error: tokenData.error_description || tokenData.error || 'Token exchange failed',
        linkedin_error: tokenData
      });
    }

    console.log('LinkedIn token exchange successful:', {
      access_token: tokenData.access_token ? 'received' : 'missing',
      expires_in: tokenData.expires_in,
      scope: tokenData.scope,
      timestamp: new Date().toISOString()
    });

    // Return the token data to frontend
    res.json({
      access_token: tokenData.access_token,
      expires_in: tokenData.expires_in,
      refresh_token: tokenData.refresh_token,
      scope: tokenData.scope,
      token_type: tokenData.token_type || 'Bearer'
    });

  } catch (error) {
    console.error('LinkedIn token exchange error:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    
    res.status(500).json({ 
      error: 'Internal server error during token exchange',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// LinkedIn profile proxy endpoint (for testing)
app.get('/api/linkedin/profile', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Missing or invalid authorization header' 
      });
    }

    const accessToken = authHeader.substring(7);

    const profileResponse = await fetch(
      'https://api.linkedin.com/v2/people/~?projection=(id,firstName,lastName,profilePicture(displayImage~:playableStreams))',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!profileResponse.ok) {
      const errorData = await profileResponse.json();
      return res.status(profileResponse.status).json({
        error: 'LinkedIn API error',
        linkedin_error: errorData
      });
    }

    const profileData = await profileResponse.json();
    res.json(profileData);

  } catch (error) {
    console.error('LinkedIn profile fetch error:', error);
    res.status(500).json({ 
      error: 'Internal server error during profile fetch' 
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString()
  });
  
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    available_endpoints: [
      'GET /health',
      'POST /api/linkedin/token',
      'GET /api/linkedin/profile'
    ]
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 LinkedIn Backend Service running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 LinkedIn OAuth: http://localhost:${PORT}/api/linkedin/token`);
  console.log(`👤 Profile endpoint: http://localhost:${PORT}/api/linkedin/profile`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`✅ CORS enabled for: ${allowedOrigins.join(', ')}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});
