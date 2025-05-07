import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
// Load environment variables from .env file
dotenv.config();
// Initialize Prisma client with proper typing
let prisma;
function getPrismaClient() {
    if (!prisma) {
        prisma = new PrismaClient();
    }
    return prisma;
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
        const response = await axios.post(GRAPHQL_URL, { query: graphqlQuery }, {
            headers: {
                'Content-Type': 'application/json',
                'X-Access-token': API_TOKEN
            }
        });
        console.log("API response received");
        // Check if response contains data
        if (!response.data || !response.data.data || !response.data.data.prices_round_trip) {
            console.log('❌ No tickets or invalid response format.');
            return;
        }
        // Use TicketData interface for type safety
        const tickets = response.data.data.prices_round_trip;
        if (!tickets || tickets.length === 0) {
            console.log('❌ No tickets found.');
            return;
        }
        console.log(`Found ${tickets.length} tickets:`);
        let newTicketsCount = 0;
        let duplicatesCount = 0;
        for (const ticket of tickets) {
            // Get outbound flight information (first segment, first leg)
            const outboundLeg = ticket.segments[0]?.flight_legs[0];
            const outboundFlight = outboundLeg?.flight_number || "Unknown";
            const outboundAirline = outboundFlight.substring(0, 2);
            // Get return flight information (second segment, first leg)
            const returnLeg = ticket.segments[1]?.flight_legs[0];
            const returnFlight = returnLeg?.flight_number || "Unknown";
            const returnAirline = returnFlight.substring(0, 2);
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
            if (!existingTicket) {
                // Create ticket in database only if it doesn't exist
                await client.ticket.create({
                    data: {
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
                    },
                });
                newTicketsCount++;
            }
            else {
                duplicatesCount++;
            }
        }
        console.log(`✅ Saved ${newTicketsCount} new tickets to database. Skipped ${duplicatesCount} duplicates.`);
    }
    catch (error) {
        console.error('Error executing request:', error);
        // Add more error information
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        }
        // Re-throw the error so the caller can handle it
        throw error;
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
function getFullTicketUrl(ticketPath) {
    return `https://www.aviasales.com/search/${ticketPath}`;
}
// Example usage when retrieving from database:
// const ticket = await prisma.ticket.findUnique({ where: { id: 1 } });
// const fullUrl = getFullTicketUrl(ticket.ticketLink);
