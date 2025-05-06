import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const prisma = new PrismaClient();

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
  try {
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
    
    console.log("Full API response:", JSON.stringify(response.data, null, 2));

    // Check if response contains data
    if (!response.data || !response.data.data || !response.data.data.prices_round_trip) {
      console.log('❌ No tickets or invalid response format.');
      return;
    }

    // Use TicketData interface for type safety
    const tickets: TicketData[] = response.data.data.prices_round_trip;

    if (!tickets || tickets.length === 0) {
      console.log('❌ No tickets found.');
      return;
    }

    console.log(`Found ${tickets.length} tickets:`);
    
    for (const ticket of tickets) {
      // Get outbound flight information (first segment, first leg)
      const outboundLeg = ticket.segments[0]?.flight_legs[0];
      const outboundFlight = outboundLeg?.flight_number || "Unknown";
      const outboundAirline = outboundFlight.substring(0, 2);
      
      // Get return flight information (second segment, first leg)
      // For round trips, there should be at least 2 segments
      const returnLeg = ticket.segments[1]?.flight_legs[0];
      const returnFlight = returnLeg?.flight_number || "Unknown";
      const returnAirline = returnFlight.substring(0, 2);
      
      // Create full ticket URL for display purposes
      const fullTicketLink = `https://www.aviasales.com/search/${ticket.ticket_link}`;
      
      // Log information about each ticket
      console.log(`
        Departure: ${ticket.departure_at}
        Return: ${ticket.return_at}
        Price: ${ticket.value} CAD
        Duration: ${ticket.trip_duration} hours
        Link: ${fullTicketLink}
        Outbound Airline: ${outboundAirline}
        Outbound Flight: ${outboundFlight}
        Return Airline: ${returnAirline}
        Return Flight: ${returnFlight}
        Origin: ${outboundLeg?.origin || "Unknown"}
        Destination: ${outboundLeg?.destination || "Unknown"}
      `);
      
      // Save to database with just the ticket path, not the full URL
      await prisma.ticket.create({
        data: {
          departureAt: ticket.departure_at,
          returnAt: ticket.return_at,
          price: ticket.value,
          tripDuration: ticket.trip_duration,
          ticketLink: ticket.ticket_link, // Store just the path
          origin: outboundLeg?.origin || "Unknown",
          destination: outboundLeg?.destination || "Unknown",
          outboundAirline: outboundAirline,
          outboundFlight: outboundFlight,
          returnAirline: returnAirline,
          returnFlight: returnFlight,
        },
      });
    }

    console.log(`✅ Saved ${tickets.length} tickets to database.`);
  } catch (error: any) {
    console.error('Error executing request:', error);
    console.error('⚠️ API or database error:', error.response?.data || error.message);
    
    // Add more error information
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response headers:', error.response.headers);
      console.error('Response data:', error.response.data);
    }
    
    // Re-throw the error so the caller can handle it
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// If this file is run directly, execute the function
if (import.meta.url === `file://${process.argv[1]}`) {
  fetchAndStoreTickets();
}

// Helper function to get the full URL
function getFullTicketUrl(ticketPath: string): string {
  return `https://www.aviasales.com/search/${ticketPath}`;
}

// Example usage when retrieving from database:
// const ticket = await prisma.ticket.findUnique({ where: { id: 1 } });
// const fullUrl = getFullTicketUrl(ticket.ticketLink);
