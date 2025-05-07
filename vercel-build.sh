#!/bin/bash
echo "Starting Vercel build process..."

# Generate Prisma client
echo "Running Prisma generate..."
npx prisma generate

# Build TypeScript
echo "Building TypeScript..."
npx tsc

# Create public directory if it doesn't exist
if [ ! -d "public" ]; then
  echo "Creating public directory..."
  mkdir -p public
fi

# Run the build.js script to create index.html
echo "Running build.js to create index.html..."
node build.js

# Verify public directory contents
echo "Verifying public directory contents..."
ls -la public/

echo "Build completed successfully!"


