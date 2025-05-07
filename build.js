import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// Ensure public directory exists
if (!fs.existsSync('public')) {
  fs.mkdirSync('public', { recursive: true });
}

// Check if index.html exists in public directory
if (!fs.existsSync(path.join('public', 'index.html'))) {
  console.error('Warning: public/index.html not found!');
  
  // Create a basic index.html if it doesn't exist
  const basicHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Flight Ticket Tracker</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }
        h1 { color: #333; }
    </style>
</head>
<body>
    <h1>Flight Ticket Tracker</h1>
    <p>This application automatically fetches flight ticket prices.</p>
</body>
</html>`;
  
  fs.writeFileSync(path.join('public', 'index.html'), basicHtml);
  console.log('Created basic index.html file');
}

// Run Prisma generate
console.log('Generating Prisma client...');
execSync('npx prisma generate', { stdio: 'inherit' });

// Build TypeScript
console.log('Building TypeScript...');
execSync('npx tsc', { stdio: 'inherit' });

console.log('Build completed successfully!');