// This file is needed for Vercel serverless functions
import express from 'express';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { fetchAndStoreTickets } from '../dist/index.js';
import fs from 'fs';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Prisma client only when needed to avoid connection issues in serverless
let prisma;
function getPrismaClient() {
  if (!prisma) {
    prisma = new PrismaClient();
  }
  return prisma;
}

// Middleware to parse JSON
app.use(express.json());

// Serve static files from the public directory
app.use(express.static('public'));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    message: 'Server is running'
  });
});

// Test endpoint to verify API is working
app.get('/api/test', (req, res) => {
  res.json({
    success: true,
    message: 'API is working',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Manual trigger endpoint for price check
app.get('/api/run-price-check', async (req, res) => {
  console.log(`Manually triggered price check at ${new Date().toISOString()}`);
  
  try {
    await fetchAndStoreTickets();
    return res.json({ 
      success: true, 
      message: 'Price check completed successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    // Log detailed error information server-side
    console.error('Price check failed:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: error.code
    });
    
    if (error.response) {
      console.error('API Response error:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      });
    }
    
    // Return a generic error message to the client in production
    // or a more detailed one in development
    return res.status(500).json({ 
      success: false, 
      error: 'Price check failed',
      message: process.env.NODE_ENV === 'production' 
        ? 'An unexpected error occurred' 
        : error.message || 'Unknown error',
      // Include a request ID to help correlate logs with specific requests
      requestId: Date.now().toString(36) + Math.random().toString(36).substr(2)
    });
  }
});

// Search flights endpoint
app.post('/api/search-flights', async (req, res) => {
  console.log(`Flight search request received at ${new Date().toISOString()}`);
  console.log('Search parameters:', req.body);
  
  try {
    const {
      origin,
      destination,
      departDateMin,
      departDateMax,
      returnDateMin,
      returnDateMax,
      currency,
      limit
    } = req.body;
    
    // Validate required parameters
    if (!origin || !destination || !departDateMin || !departDateMax || !returnDateMin || !returnDateMax) {
      return res.status(400).json({
        success: false,
        message: 'Missing required search parameters'
      });
    }
    
    // Build GraphQL query with the provided parameters
    const graphqlQuery = `
    {
      prices_round_trip(
        params: {
          origin: "${origin}"
          destination: "${destination}"
          depart_date_min: "${departDateMin}"
          depart_date_max: "${departDateMax}"
          return_date_min: "${returnDateMin}"
          return_date_max: "${returnDateMax}"
          no_lowcost: true
        }
        paging: {
          limit: ${parseInt(limit) || 5}
          offset: 0
        }
        sorting: VALUE_ASC
        currency: "${currency || 'cad'}"
      ) {
        departure_at
        return_at
        value
        trip_duration
        ticket_link
        segments {
          flight_legs {
            aircraft_code
            flight_number
            origin
            destination
            departure_at
            arrival_at
          }
        }
      }
    }`;
    
    // Get API key from environment variables
    const API_TOKEN = process.env.TRAVELPAYOUTS_API_TOKEN;
    
    // Check if API key exists
    if (!API_TOKEN) {
      console.error('❌ API key not found. Make sure the .env file contains TRAVELPAYOUTS_API_TOKEN');
      return res.status(500).json({
        success: false,
        message: 'API key not configured on server'
      });
    }
    
    // GraphQL API endpoint
    const GRAPHQL_URL = 'https://api.travelpayouts.com/graphql/v1/query';
    
    console.log("Making API request to:", GRAPHQL_URL);
    
    const axios = (await import('axios')).default;
    const response = await axios.post(
      GRAPHQL_URL,
      { query: graphqlQuery },
      { 
        headers: { 
          'Content-Type': 'application/json',
          'X-Access-token': API_TOKEN
        } 
      }
    );
    
    console.log("API response received with status:", response.status);
    
    // Check if response contains data
    if (!response.data) {
      console.error('❌ No data in response:', response);
      throw new Error('No data in API response');
    }
    
    if (!response.data.data) {
      console.error('❌ No data.data in response:', response.data);
      throw new Error('Invalid API response format: missing data.data');
    }
    
    if (!response.data.data.prices_round_trip) {
      console.error('❌ No prices_round_trip in response:', response.data.data);
      throw new Error('Invalid API response format: missing prices_round_trip');
    }
    
    // Get tickets from response
    const tickets = response.data.data.prices_round_trip;
    
    console.log(`Found ${tickets.length} tickets in API response`);
    
    // Return tickets to client
    return res.json({
      success: true,
      message: `Found ${tickets.length} flights`,
      tickets: tickets
    });
    
  } catch (error) {
    // Log detailed error information server-side
    console.error('Flight search failed:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: error.code
    });
    
    if (error.response) {
      console.error('API Response error:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      });
    }
    
    // Return a generic error message to the client in production
    // or a more detailed one in development
    return res.status(500).json({ 
      success: false, 
      error: 'Flight search failed',
      message: process.env.NODE_ENV === 'production' 
        ? 'An unexpected error occurred' 
        : error.message || 'Unknown error',
      // Include a request ID to help correlate logs with specific requests
      requestId: Date.now().toString(36) + Math.random().toString(36).substr(2)
    });
  }
});

// Default route
app.get('/', (req, res) => {
  try {
    // Check if index.html exists
    const indexPath = './public/index.html';
    if (fs.existsSync(indexPath)) {
      res.sendFile('index.html', { root: './public' });
    } else {
      // If index.html doesn't exist, send a basic HTML response
      res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Flight Ticket Tracker</title>
            <style>
                body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
                h1 { color: #333; }
            </style>
        </head>
        <body>
            <h1>Flight Ticket Tracker</h1>
            <p>This application automatically fetches flight ticket prices.</p>
            <p><a href="/api/health">Check API Status</a></p>
        </body>
        </html>
      `);
    }
  } catch (error) {
    console.error('Error serving index.html:', error);
    res.status(500).send('Error loading page. Please try again later.');
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  // Log detailed error information
  console.error('Unhandled error:', err);
  console.error('Error details:', {
    name: err.name,
    message: err.message,
    stack: err.stack,
    code: err.code
  });
  
  // Generate a request ID to help correlate logs with specific requests
  const requestId = Date.now().toString(36) + Math.random().toString(36).substr(2);
  
  res.status(500).json({
    success: false,
    error: 'Server error',
    message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message,
    requestId: requestId
  });
});

// Only start the server if not in a serverless environment
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server running on port http://localhost:${PORT}`);
  });
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  if (prisma) {
    await prisma.$disconnect();
  }
  process.exit(0);
});

// Export for serverless
export default app;

