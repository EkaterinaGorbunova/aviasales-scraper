#!/bin/bash
# Generate Prisma client
echo "Running Prisma generate..."
npx prisma generate

# Build TypeScript
echo "Building TypeScript..."
npx tsc

echo "Build completed successfully!"