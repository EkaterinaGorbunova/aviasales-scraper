// This file is needed for Vercel serverless functions
import express from 'express';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { fetchAndStoreTickets } from '../dist/index.js';
import fs from 'fs';
import cors from 'cors';

dotenv.config();

// Validate required environment variables
const requiredEnvVars = ['DATABASE_URL', 'TRAVELPAYOUTS_API_TOKEN'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingEnvVars.join(', '));
  console.error('Please set these variables in your .env file or in your hosting environment');
  
  if (process.env.NODE_ENV === 'production') {
    process.exit(1); // Exit in production to prevent starting with missing config
  }
}

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

// Add CORS middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://aviasales-scraper.vercel.app/', 'https://www.aviasales-scraper.vercel.app/'] 
    : '*'
}));

// Serve static files from the public directory
app.use(express.static('public', {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
  index: ['index.html']
}));

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
    // Extract search parameters from request body
    const {
      origin,
      destination,
      departDateMin,
      departDateMax,
      returnDateMin,
      returnDateMax,
      currency = 'cad',  // Default to CAD if not specified
      limit = 5          // Default to 5 results if not specified
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
        currency: "${currency.toLowerCase()}"
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
    
    // Ensure all ticket links have the correct domain
    tickets.forEach(ticket => {
      if (ticket.ticket_link && !ticket.ticket_link.startsWith('http')) {
        ticket.ticket_link = `https://www.aviasales.com/search${ticket.ticket_link}`;
      }
    });
    
    // NEW CODE: Save tickets to database
    const client = getPrismaClient();
    let newTicketsCount = 0;
    let duplicatesCount = 0;
    
    try {
      console.log("Saving search results to database...");
      
      for (const ticket of tickets) {
        try {
          // Get outbound flight information (first segment, first leg)
          const outboundLeg = ticket.segments[0]?.flight_legs[0];
          const outboundFlight = outboundLeg?.flight_number || "Unknown";
          const outboundAirline = outboundFlight.substring(0, 2);
          
          // Get return flight information (second segment, first leg)
          const returnLeg = ticket.segments[1]?.flight_legs[0];
          const returnFlight = returnLeg?.flight_number || "Unknown";
          const returnAirline = returnFlight.substring(0, 2);
          
          console.log(`Processing ticket: ${outboundFlight} to ${returnFlight}, ${ticket.departure_at} - ${ticket.return_at}`);
          
          // Check if this ticket already exists in the database
          const existingTicket = await client.ticket.findFirst({
            where: {
              departureAt: ticket.departure_at,
              returnAt: ticket.return_at,
              outboundFlight: outboundFlight,
              returnFlight: returnFlight,
              origin: outboundLeg?.origin || "Unknown",
              destination: outboundLeg?.destination || "Unknown"
            }
          });
          
          if (existingTicket) {
            console.log(`Ticket already exists in database with ID: ${existingTicket.id}`);
            duplicatesCount++;
          } else {
            console.log("Creating new ticket record in database...");
            // Create ticket data object for better debugging
            const ticketData = {
              departureAt: ticket.departure_at,
              returnAt: ticket.return_at,
              price: ticket.value,
              tripDuration: ticket.trip_duration,
              ticketLink: ticket.ticket_link,
              origin: outboundLeg?.origin || "Unknown",
              destination: outboundLeg?.destination || "Unknown",
              outboundAirline: outboundAirline,
              outboundFlight: outboundFlight,
              returnAirline: returnAirline,
              returnFlight: returnFlight,
            };
            
            // Create ticket in database only if it doesn't exist
            const newTicket = await client.ticket.create({
              data: ticketData,
            });
            
            console.log(`New ticket created with ID: ${newTicket.id}`);
            newTicketsCount++;
          }
        } catch (ticketError) {
          console.error('Error processing ticket:', ticketError);
          // Continue with other tickets instead of failing the entire batch
        }
      }
      
      console.log(`✅ Saved ${newTicketsCount} new tickets to database. Skipped ${duplicatesCount} duplicates.`);
    } catch (dbError) {
      console.error('Error saving tickets to database:', dbError);
      // Continue to return results to the user even if database save fails
    }
    
    // Return tickets to client
    return res.json({
      success: true,
      message: `Found ${tickets.length} flights (Saved ${newTicketsCount} new tickets to database)`,
      tickets: tickets,
      dbStats: {
        newTickets: newTicketsCount,
        duplicates: duplicatesCount
      }
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
    // Log the current directory and files for debugging
    console.log('Current directory:', process.cwd());
    console.log('Public directory exists:', fs.existsSync('./public'));
    
    if (fs.existsSync('./public')) {
      console.log('Files in public directory:', fs.readdirSync('./public'));
    }
    
    // Check if index.html exists
    const indexPath = './public/index.html';
    if (fs.existsSync(indexPath)) {
      console.log('Serving index.html from public directory');
      return res.sendFile('index.html', { root: './public' });
    } else {
      console.log('index.html not found, serving fallback HTML');
      // If index.html doesn't exist, send a basic HTML response
      return res.send(`
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









