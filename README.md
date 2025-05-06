# Flight Ticket Tracker

Flight Ticket Tracker is a simple application that helps travelers find the best flight deals. It automatically fetches flight ticket prices from aviasales.com using their Travelpayouts API and stores tickets information in a database for easy comparison and tracking.

## Problem Solved
Finding affordable flights on aviasales.com can be time-consuming and frustrating. This application automates the process of checking flight prices, allowing users to:
- Track price changes for specific routes
- Find the cheapest time to fly
- Save money on travel expenses

## Tech Stack
- **Backend**: Node.js, TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **API**: Travelpayouts GraphQL API (aviasales.com data provider)
- **Dependencies**: Axios for HTTP requests, dotenv for environment variables

## Current Features
- Fetch flight prices from aviasales.com using Travelpayouts GraphQL API
- Store flight data in PostgreSQL database
- Filter flights by origin, destination and date ranges
- Sort results by price (lowest first)
- Track round-trip flight information including:
  - Departure and return dates
  - Price
  - Trip duration
  - Airlines and flight numbers
  - Direct ticket links to Aviasales.com

## Planned Features
- Automated price checking at regular intervals
- Price change notifications via email
- Fare alerts when prices drop below a specified threshold
- User accounts to save favorite routes
- Price history graphs and analytics
- Mobile-friendly web interface
- Support for one-way flights and multi-city trips
- Integration with calendar to find optimal travel dates

## Run the Application

```bash
# Clone the repository
git clone https://github.com/EkaterinaGorbunova/aviasales-scraper.git
cd aviasales-scraper

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Update .env with your Travelpayouts API token

# Generate Prisma Client and create database
npx prisma generate
npx prisma db push

# Run the application
npm run dev
```


