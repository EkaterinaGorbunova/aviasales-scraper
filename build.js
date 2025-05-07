import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('Starting build process...');

// Ensure public directory exists
if (!fs.existsSync('public')) {
  console.log('Creating public directory...');
  fs.mkdirSync('public', { recursive: true });
}

// Create index.html in public directory
console.log('Creating index.html...');
const indexHtml = `<!DOCTYPE html>
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
        .card {
            background-color: #f5f5f5;
            border-radius: 8px;
            padding: 20px;
            margin-top: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        button {
            background-color: #4CAF50;
            color: white;
            border: none;
            padding: 10px 15px;
            border-radius: 4px;
            cursor: pointer;
        }
        button:disabled {
            background-color: #cccccc;
        }
    </style>
</head>
<body>
    <h1>Flight Ticket Tracker</h1>
    <p>This application automatically fetches flight ticket prices.</p>
    
    <div class="card">
        <h2>Manual Price Check</h2>
        <button id="checkButton" onclick="runCheck()">Run Price Check</button>
        <div id="result"></div>
    </div>
    
    <script>
        async function runCheck() {
            const button = document.getElementById('checkButton');
            const result = document.getElementById('result');
            
            button.disabled = true;
            button.textContent = 'Running...';
            
            try {
                const response = await fetch('/api/run-price-check');
                const data = await response.json();
                
                if (data.success) {
                    result.innerHTML = '<p style="color: green">✅ Price check completed successfully</p>';
                } else {
                    result.innerHTML = '<p style="color: red">❌ Error: ' + data.message + '</p>';
                }
            } catch (error) {
                result.innerHTML = '<p style="color: red">❌ Failed to run price check</p>';
            }
            
            button.disabled = false;
            button.textContent = 'Run Price Check';
        }
    </script>
</body>
</html>`;

fs.writeFileSync(path.join('public', 'index.html'), indexHtml);
console.log('index.html created successfully');

// Run Prisma generate
console.log('Generating Prisma client...');
try {
  execSync('npx prisma generate', { stdio: 'inherit' });
  console.log('Prisma client generated successfully');
} catch (error) {
  console.error('Error generating Prisma client:', error);
  process.exit(1);
}

// Build TypeScript
console.log('Building TypeScript...');
try {
  execSync('npx tsc', { stdio: 'inherit' });
  console.log('TypeScript build completed successfully');
} catch (error) {
  console.error('Error building TypeScript:', error);
  process.exit(1);
}

// Ensure dist directory exists
if (!fs.existsSync('dist')) {
  console.log('Creating dist directory...');
  fs.mkdirSync('dist', { recursive: true });
}

// Copy public folder to dist folder
console.log('Copying public folder to dist folder...');
copyFolderRecursiveSync('public', 'dist');
console.log('Public folder copied to dist successfully');

// Verify that the public directory and index.html exist
if (fs.existsSync('public') && fs.existsSync(path.join('public', 'index.html'))) {
  console.log('Verified: public/index.html exists');
} else {
  console.error('Error: public/index.html is missing after build');
  process.exit(1);
}

// Verify that the dist/public directory exists
if (fs.existsSync(path.join('dist', 'public'))) {
  console.log('Verified: dist/public directory exists');
} else {
  console.error('Error: dist/public directory is missing after build');
  process.exit(1);
}

console.log('Build completed successfully!');

// Function to copy a file
function copyFileSync(source, target) {
  let targetFile = target;
  
  // If target is a directory, a new file with the same name will be created
  if (fs.existsSync(target) && fs.lstatSync(target).isDirectory()) {
    targetFile = path.join(target, path.basename(source));
  }
  
  fs.writeFileSync(targetFile, fs.readFileSync(source));
  console.log(`Copied file: ${source} -> ${targetFile}`);
}

// Function to copy a folder recursively
function copyFolderRecursiveSync(source, target) {
  // Check if folder needs to be created or integrated
  const targetFolder = path.join(target, path.basename(source));
  if (!fs.existsSync(targetFolder)) {
    fs.mkdirSync(targetFolder, { recursive: true });
    console.log(`Created directory: ${targetFolder}`);
  }
  
  // Copy files and subfolders
  if (fs.lstatSync(source).isDirectory()) {
    const files = fs.readdirSync(source);
    files.forEach(function(file) {
      const currentSource = path.join(source, file);
      if (fs.lstatSync(currentSource).isDirectory()) {
        copyFolderRecursiveSync(currentSource, targetFolder);
      } else {
        copyFileSync(currentSource, targetFolder);
      }
    });
  }
}


