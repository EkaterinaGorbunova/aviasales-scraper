import express from 'express';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { fetchAndStoreTickets } from './dist/index.js';
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














