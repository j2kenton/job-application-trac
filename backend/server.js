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
  'http://localhost:5170',
  'http://localhost:5171',
  'http://localhost:5172',
  'http://localhost:5173',
  'http://localhost:5174', 
  'http://localhost:5175',
  'http://localhost:5176',
  'http://localhost:5177',
  'http://localhost:5178',
  'http://localhost:5179',
  'http://localhost:5180',
  'http://localhost:3000'
];

// Debug log to verify the configuration
console.log('🔧 DEBUG: Loaded CORS origins:', allowedOrigins);

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

// Multi-stage company search endpoint
app.post('/api/linkedin/companies/search', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const { query } = req.body;
    
    if (!query) {
      return res.status(400).json({ 
        error: 'Missing required parameter: query' 
      });
    }

    console.log('Company search request:', {
      query: query,
      timestamp: new Date().toISOString()
    });

    let companies = [];

    // Stage 1: Try LinkedIn API if we have auth
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const accessToken = authHeader.substring(7);
      
      try {
        console.log('Trying LinkedIn API search...');
        
        // Try multiple LinkedIn API endpoints
        const endpoints = [
          `https://api.linkedin.com/v2/companySearch?q=text&text=${encodeURIComponent(query)}`,
          `https://api.linkedin.com/v2/companies?keywords=${encodeURIComponent(query)}`,
          `https://api.linkedin.com/rest/companySearch?keywords=${encodeURIComponent(query)}`
        ];

        for (const endpoint of endpoints) {
          try {
            const searchResponse = await fetch(endpoint, {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'LinkedIn-Version': '202405',
                'X-Restli-Protocol-Version': '2.0.0'
              }
            });

            if (searchResponse.ok) {
              const searchData = await searchResponse.json();
              
              if (searchData.elements && searchData.elements.length > 0) {
                companies = searchData.elements.map((company) => ({
                  id: company.id || company.entityUrn,
                  name: company.name || company.localizedName,
                  industry: company.industry,
                  size: company.staffCount || company.companySize,
                  location: company.locations?.[0]?.country || company.location?.country,
                  logoUrl: company.logo?.image || company.logoV2?.original,
                  source: 'linkedin'
                }));
                
                console.log(`LinkedIn API success with ${companies.length} results`);
                break;
              }
            }
          } catch (endpointError) {
            console.log(`LinkedIn endpoint failed: ${endpoint}`, endpointError.message);
          }
        }
      } catch (linkedinError) {
        console.warn('LinkedIn API search failed:', linkedinError.message);
      }
    }

    // Stage 2: If LinkedIn didn't return results, use fallback data sources
    if (companies.length === 0) {
      console.log('Using fallback company search...');
      companies = await searchCompaniesFallback(query);
    }

    console.log('Company search completed:', {
      query: query,
      resultsCount: companies.length,
      sources: [...new Set(companies.map(c => c.source))]
    });

    res.json(companies);

  } catch (error) {
    console.error('Company search error:', error);
    
    // Even if everything fails, return some basic results
    const fallbackResult = [{
      id: `custom-${Date.now()}`,
      name: query,
      industry: 'Technology',
      size: 'Unknown',
      location: 'Unknown',
      logoUrl: null,
      source: 'manual'
    }];
    
    res.json(fallbackResult);
  }
});

// Fallback company search function
async function searchCompaniesFallback(query) {
  const companies = [];
  
  try {
    // Stage 2a: Try public APIs (like Clearbit, RapidAPI, etc.)
    // For now, we'll use a curated list of common companies
    const commonCompanies = await searchCommonCompanies(query);
    companies.push(...commonCompanies);
    
    // Stage 2b: Use web scraping of public data (be careful about rate limits)
    // This could include scraping Google search results, company websites, etc.
    // For MVP, we'll skip this to avoid legal issues
    
    // Stage 2c: Generate intelligent suggestions based on query
    const suggestions = generateCompanySuggestions(query);
    companies.push(...suggestions);
    
  } catch (error) {
    console.warn('Fallback search failed:', error.message);
  }
  
  return companies.slice(0, 10); // Limit to 10 results
}

// Search common companies database
async function searchCommonCompanies(query) {
  const commonCompanies = [
    { name: 'Google', industry: 'Technology', size: '100,000+', location: 'United States' },
    { name: 'Microsoft', industry: 'Technology', size: '100,000+', location: 'United States' },
    { name: 'Apple', industry: 'Technology', size: '100,000+', location: 'United States' },
    { name: 'Amazon', industry: 'E-commerce', size: '100,000+', location: 'United States' },
    { name: 'Meta', industry: 'Technology', size: '50,000+', location: 'United States' },
    { name: 'Netflix', industry: 'Entertainment', size: '10,000+', location: 'United States' },
    { name: 'Tesla', industry: 'Automotive', size: '50,000+', location: 'United States' },
    { name: 'IBM', industry: 'Technology', size: '100,000+', location: 'United States' },
    { name: 'Oracle', industry: 'Technology', size: '50,000+', location: 'United States' },
    { name: 'Salesforce', industry: 'Technology', size: '50,000+', location: 'United States' },
    { name: 'Adobe', industry: 'Technology', size: '25,000+', location: 'United States' },
    { name: 'Intel', industry: 'Technology', size: '100,000+', location: 'United States' },
    { name: 'Nvidia', industry: 'Technology', size: '25,000+', location: 'United States' },
    { name: 'PayPal', industry: 'Fintech', size: '25,000+', location: 'United States' },
    { name: 'Uber', industry: 'Transportation', size: '25,000+', location: 'United States' },
    { name: 'Airbnb', industry: 'Travel', size: '10,000+', location: 'United States' },
    { name: 'Spotify', industry: 'Entertainment', size: '10,000+', location: 'Sweden' },
    { name: 'Slack', industry: 'Technology', size: '5,000+', location: 'United States' },
    { name: 'Zoom', industry: 'Technology', size: '10,000+', location: 'United States' },
    { name: 'Shopify', industry: 'E-commerce', size: '10,000+', location: 'Canada' }
  ];
  
  const queryLower = query.toLowerCase();
  const matches = commonCompanies.filter(company => 
    company.name.toLowerCase().includes(queryLower) ||
    queryLower.includes(company.name.toLowerCase())
  );
  
  return matches.map((company, index) => ({
    id: `common-${index}`,
    name: company.name,
    industry: company.industry,
    size: company.size,
    location: company.location,
    logoUrl: `https://logo.clearbit.com/${company.name.toLowerCase().replace(/\s+/g, '')}.com`,
    source: 'database'
  }));
}

// Generate intelligent company suggestions
function generateCompanySuggestions(query) {
  const suggestions = [];
  
  // If query looks like a domain, extract company name
  if (query.includes('.com') || query.includes('.org') || query.includes('.net')) {
    const domain = query.replace(/https?:\/\//, '').replace(/www\./, '').split('.')[0];
    const companyName = domain.charAt(0).toUpperCase() + domain.slice(1);
    
    suggestions.push({
      id: `suggestion-domain`,
      name: companyName,
      industry: 'Unknown',
      size: 'Unknown',
      location: 'Unknown',
      logoUrl: `https://logo.clearbit.com/${query}`,
      source: 'suggestion'
    });
  }
  
  // Always include the query as a potential company name
  suggestions.push({
    id: `suggestion-${Date.now()}`,
    name: query,
    industry: 'Unknown',
    size: 'Unknown',
    location: 'Unknown',
    logoUrl: null,
    source: 'custom'
  });
  
  return suggestions;
}

// LinkedIn token revocation proxy endpoint
app.post('/api/linkedin/revoke', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Missing or invalid authorization header' 
      });
    }

    const accessToken = authHeader.substring(7);
    
    console.log('LinkedIn token revocation request:', {
      timestamp: new Date().toISOString()
    });

    // Revoke the token via LinkedIn API
    const revokeResponse = await fetch('https://api.linkedin.com/v2/oauth2/revoke', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        token: accessToken,
        client_id: process.env.LINKEDIN_CLIENT_ID,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET
      })
    });

    if (!revokeResponse.ok) {
      console.warn('LinkedIn token revocation failed:', {
        status: revokeResponse.status,
        statusText: revokeResponse.statusText
      });
      
      // Don't fail the logout process - token clearing on frontend is more important
      return res.json({ success: false, message: 'Token revocation failed but logout completed' });
    }

    console.log('LinkedIn token revocation successful');
    res.json({ success: true, message: 'Token revoked successfully' });

  } catch (error) {
    console.error('LinkedIn token revocation error:', error);
    // Don't fail the logout process
    res.json({ success: false, message: 'Token revocation failed but logout completed' });
  }
});

// LinkedIn profile proxy endpoint
app.get('/api/linkedin/profile', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Missing or invalid authorization header' 
      });
    }

    const accessToken = authHeader.substring(7);
    
    console.log('LinkedIn profile request:', {
      timestamp: new Date().toISOString(),
      hasToken: !!accessToken
    });

    // Get basic profile info
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
      // Get more detailed error information
      let errorDetails = {};
      try {
        errorDetails = await profileResponse.json();
      } catch (e) {
        errorDetails = { message: 'Unable to parse error response' };
      }

      console.error('LinkedIn profile fetch failed:', {
        status: profileResponse.status,
        statusText: profileResponse.statusText,
        errorDetails: errorDetails,
        tokenLength: accessToken.length,
        tokenPrefix: accessToken.substring(0, 10) + '...',
        timestamp: new Date().toISOString()
      });

      return res.status(profileResponse.status).json({
        error: 'LinkedIn API error',
        details: profileResponse.statusText,
        linkedin_error: errorDetails
      });
    }

    const profileData = await profileResponse.json();

    // Get email address separately (requires email scope)
    const emailResponse = await fetch('https://api.linkedin.com/v2/emailAddress?q=members&projection=(elements*(handle~))', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    let emailAddress = '';
    if (emailResponse.ok) {
      const emailData = await emailResponse.json();
      emailAddress = emailData.elements?.[0]?.['handle~']?.emailAddress || '';
    }

    const profile = {
      id: profileData.id,
      firstName: profileData.firstName?.localized?.en_US || '',
      lastName: profileData.lastName?.localized?.en_US || '',
      emailAddress: emailAddress,
      profilePicture: profileData.profilePicture?.displayImage?.elements?.[0]?.identifiers?.[0]?.identifier
    };

    console.log('LinkedIn profile fetch successful:', {
      id: profile.id,
      firstName: profile.firstName,
      lastName: profile.lastName,
      hasEmail: !!profile.emailAddress,
      hasProfilePicture: !!profile.profilePicture
    });

    res.json(profile);

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
      'GET /api/linkedin/profile',
      'POST /api/linkedin/companies/search',
      'POST /api/linkedin/revoke'
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
