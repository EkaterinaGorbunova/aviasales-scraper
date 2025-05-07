import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Initialize Prisma client with proper typing
let prisma: PrismaClient | undefined;
function getPrismaClient(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient();
  }
  return prisma;
}

interface FlightLeg {
  aircraft_code: string;
  flight_number: string;
  origin: string;
  destination: string;
  departure_at: string;
  arrival_at: string;
}

interface Segment {
  flight_legs: FlightLeg[];
}

interface TicketData {
  departure_at: string;
  return_at: string;
  value: number;
  trip_duration: number;
  ticket_link: string;
  segments: Segment[];
}

// Interface for REST API ticket structure (if needed in the future)
interface TicketRestData {
  airline: string;
  departure_at: string;
  price: number;
  [key: string]: any; // For other possible fields
}

// Get API key from environment variables
const API_TOKEN = process.env.TRAVELPAYOUTS_API_TOKEN;

// Check if API key exists
if (!API_TOKEN) {
  console.error('❌ API key not found. Make sure the .env file contains TRAVELPAYOUTS_API_TOKEN');
  process.exit(1);
}

// GraphQL API endpoint
const GRAPHQL_URL = 'https://api.travelpayouts.com/graphql/v1/query';

const graphqlQuery = `
{
  prices_round_trip(
    params: {
      origin: "YMQ"
      destination: "YVR"
      depart_date_min: "2025-07-25"
      depart_date_max: "2025-07-29"
      return_date_min: "2025-08-07"
      return_date_max: "2025-08-11"
      no_lowcost: true
    }
    paging: {
      limit: 5
      offset: 0
    }
    sorting: VALUE_ASC
    currency: "cad"
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

export async function fetchAndStoreTickets() {
  console.log("GraphQL API request started...");
  const client = getPrismaClient();
  
  try {
    console.log("Making API request to:", GRAPHQL_URL);
    
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

    // Use TicketData interface for type safety
    const tickets: TicketData[] = response.data.data.prices_round_trip;

    if (!tickets || tickets.length === 0) {
      console.log('❌ No tickets found in API response.');
      return;
    }

    console.log(`Found ${tickets.length} tickets in API response`);
    console.log("First ticket sample:", JSON.stringify(tickets[0], null, 2));
    
    // Test database connection before proceeding
    try {
      console.log("Testing database connection...");
      await client.$queryRaw`SELECT 1`;
      console.log("Database connection test successful");
    } catch (dbError: any) {
      console.error("Database connection test failed:", dbError);
      throw new Error(`Database connection failed: ${dbError.message}`);
    }
    
    let newTicketsCount = 0;
    let duplicatesCount = 0;
    
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
          
          console.log("Ticket data to insert:", JSON.stringify(ticketData, null, 2));
          
          // Create ticket in database only if it doesn't exist
          const newTicket = await client.ticket.create({
            data: ticketData,
          });
          
          console.log(`New ticket created with ID: ${newTicket.id}`);
          newTicketsCount++;
        }
      } catch (ticketError) {
        console.error('Error processing ticket:', ticketError);
        console.error('Ticket data that caused the error:', JSON.stringify(ticket, null, 2));
        // Continue with other tickets instead of failing the entire batch
      }
    }

    console.log(`✅ Saved ${newTicketsCount} new tickets to database. Skipped ${duplicatesCount} duplicates.`);
  } catch (error: any) {
    console.error('Error executing request:', error);
    
    // Add more error information
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    
    // Re-throw the error so the caller can handle it
    throw error;
  } finally {
    // Always disconnect from the database to prevent connection leaks
    try {
      await client.$disconnect();
      console.log("Database connection closed");
    } catch (disconnectError) {
      console.error('Error disconnecting from database:', disconnectError);
    }
  }
}

// If this file is run directly, execute the function
if (import.meta.url === `file://${process.argv[1]}`) {
  fetchAndStoreTickets()
    .catch(console.error)
    .finally(async () => {
      if (prisma) {
        await prisma.$disconnect();
      }
    });
}

// Helper function to get the full URL
function getFullTicketUrl(ticketPath: string): string {
  return `https://www.aviasales.com/search/${ticketPath}`;
}

// Example usage when retrieving from database:
// const ticket = await prisma.ticket.findUnique({ where: { id: 1 } });
// const fullUrl = getFullTicketUrl(ticket.ticketLink);
