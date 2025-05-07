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

# Copy static files to public directory
echo "Copying static files..."
if [ -d "dist/public" ]; then
  cp -r dist/public/* public/
fi

echo "Build completed successfully!"

