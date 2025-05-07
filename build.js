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
    <!-- Simple UTC clock icon as favicon -->
    <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><circle cx=%2250%22 cy=%2250%22 r=%2245%22 fill=%22white%22 stroke=%22%234CAF50%22 stroke-width=%225%22 /><text x=%2250%22 y=%2250%22 text-anchor=%22middle%22 dominant-baseline=%22middle%22 font-family=%22Arial%22 font-size=%2240%22 font-weight=%22bold%22 fill=%22%234CAF50%22>8</text><text x=%2250%22 y=%2270%22 text-anchor=%22middle%22 dominant-baseline=%22middle%22 font-family=%22Arial%22 font-size=%2215%22 fill=%22%234CAF50%22>UTC</text></svg>" type="image/svg+xml">
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
        pre {
            background-color: #f0f0f0;
            padding: 10px;
            border-radius: 4px;
            overflow-x: auto;
        }
        .form-group {
            margin-bottom: 15px;
        }
        label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
        }
        input, select {
            width: 100%;
            padding: 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
            box-sizing: border-box;
        }
        .form-row {
            display: flex;
            gap: 15px;
        }
        .form-row > div {
            flex: 1;
        }
        .results {
            margin-top: 20px;
        }
        .ticket {
            border: 1px solid #ddd;
            border-radius: 4px;
            padding: 15px;
            margin-bottom: 15px;
            background-color: white;
        }
        .price {
            font-size: 1.5em;
            font-weight: bold;
            color: #4CAF50;
        }
        .price-usd {
            font-size: 1.1em;
            color: #666;
            margin-top: 5px;
            font-style: italic;
        }
        .flight-info {
            display: flex;
            justify-content: space-between;
            margin-top: 10px;
        }
    </style>
</head>
<body>
    <h1>Flight Ticket Tracker</h1>
    <p>This application helps you find the best flight deals.</p>
    
    <div class="card">
        <h2>Search Flights</h2>
        <form id="searchForm">
            <div class="form-row">
                <div class="form-group">
                    <label for="origin">Origin</label>
                    <input type="text" id="origin" name="origin" placeholder="e.g. YUL" value="YUL" required>
                </div>
                <div class="form-group">
                    <label for="destination">Destination</label>
                    <input type="text" id="destination" name="destination" placeholder="e.g. YVR" value="YVR" required>
                </div>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label for="departDateMin">Departure Date (Earliest)</label>
                    <input type="date" id="departDateMin" name="departDateMin" required>
                </div>
                <div class="form-group">
                    <label for="departDateMax">Departure Date (Latest)</label>
                    <input type="date" id="departDateMax" name="departDateMax" required>
                </div>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label for="returnDateMin">Return Date (Earliest)</label>
                    <input type="date" id="returnDateMin" name="returnDateMin" required>
                </div>
                <div class="form-group">
                    <label for="returnDateMax">Return Date (Latest)</label>
                    <input type="date" id="returnDateMax" name="returnDateMax" required>
                </div>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label for="currency">Currency</label>
                    <select id="currency" name="currency">
                        <option value="cad">CAD</option>
                        <option value="usd">USD</option>
                        <option value="eur">EUR</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="limit">Results Limit</label>
                    <select id="limit" name="limit">
                        <option value="5">5</option>
                        <option value="10">10</option>
                        <option value="20">20</option>
                    </select>
                </div>
            </div>
            
            <button type="submit" id="searchButton">Search Flights</button>
        </form>
        
        <div id="searchResults" class="results"></div>
    </div>
    
    <div class="card">
        <h2>API Status</h2>
        <button onclick="testApi('/api/health')">Test Health</button>
        <button onclick="testApi('/api/test')">Test API</button>
        <div id="apiStatus"></div>
    </div>
    
    <script>
        // Set default dates
        document.addEventListener('DOMContentLoaded', function() {
            // Set specific dates
            document.getElementById('departDateMin').value = "2025-07-25";
            document.getElementById('departDateMax').value = "2025-07-29";
            document.getElementById('returnDateMin').value = "2025-08-07";
            document.getElementById('returnDateMax').value = "2025-08-11";
        });
        
        function formatDate(date) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return \`\${year}-\${month}-\${day}\`;
        }
        
        // Handle form submission
        document.getElementById('searchForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const searchButton = document.getElementById('searchButton');
            const resultsDiv = document.getElementById('searchResults');
            
            searchButton.disabled = true;
            searchButton.textContent = 'Searching...';
            resultsDiv.innerHTML = '<p>Searching for flights...</p>';
            
            // Get form values
            const formData = {
                origin: document.getElementById('origin').value,
                destination: document.getElementById('destination').value,
                departDateMin: document.getElementById('departDateMin').value,
                departDateMax: document.getElementById('departDateMax').value,
                returnDateMin: document.getElementById('returnDateMin').value,
                returnDateMax: document.getElementById('returnDateMax').value,
                currency: document.getElementById('currency').value,
                limit: document.getElementById('limit').value
            };
            
            try {
                const response = await fetch('/api/search-flights', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(formData)
                });
                
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(\`Server responded with \${response.status}: \${errorText}\`);
                }
                
                const data = await response.json();
                
                if (data.success) {
                    if (data.tickets && data.tickets.length > 0) {
                        displayTickets(data.tickets, formData.currency);
                    } else {
                        resultsDiv.innerHTML = '<p>No flights found for your search criteria.</p>';
                    }
                } else {
                    resultsDiv.innerHTML = \`<p style="color: red">❌ Error: \${data.message || 'Unknown error'}</p>\`;
                    console.error('API error details:', data);
                }
            } catch (error) {
                resultsDiv.innerHTML = \`<p style="color: red">❌ Search failed: \${error.message}</p>\`;
                console.error('Request error:', error);
            }
            
            searchButton.disabled = false;
            searchButton.textContent = 'Search Flights';
        });
        
        function displayTickets(tickets, currency) {
            const resultsDiv = document.getElementById('searchResults');
            resultsDiv.innerHTML = \`<h3>Found \${tickets.length} flights</h3>\`;
            
            const currencySymbol = getCurrencySymbol(currency);
            
            tickets.forEach(ticket => {
                const departDate = new Date(ticket.departure_at);
                const returnDate = new Date(ticket.return_at);
                
                // Ensure ticket_link is properly formatted
                const ticketUrl = ticket.ticket_link.startsWith('http') 
                    ? ticket.ticket_link 
                    : \`https://www.aviasales.com/search\${ticket.ticket_link}\`;
                
                // Calculate USD price if not already in USD
                let usdPrice = ticket.value;
                let usdDisplay = '';
                
                if (currency.toLowerCase() !== 'usd') {
                    // Approximate conversion rates
                    const conversionRates = {
                        'cad': 0.74, // 1 CAD = 0.74 USD
                        'eur': 1.09  // 1 EUR = 1.09 USD
                    };
                    
                    const rate = conversionRates[currency.toLowerCase()] || 1;
                    usdPrice = Math.round(ticket.value * rate);
                    usdDisplay = \`<div class="price-usd">≈ $\${usdPrice} USD</div>\`;
                }
                
                const ticketHtml = \`
                    <div class="ticket">
                        <div class="price">\${currencySymbol}\${ticket.value} \${currency.toUpperCase()}</div>
                        \${usdDisplay}
                        <div class="flight-info">
                            <div>
                                <strong>Outbound:</strong> \${formatDateForDisplay(departDate)}<br>
                                <span>\${ticket.segments[0]?.flight_legs[0]?.flight_number || 'N/A'}</span>
                            </div>
                            <div>
                                <strong>Return:</strong> \${formatDateForDisplay(returnDate)}<br>
                                <span>\${ticket.segments[1]?.flight_legs[0]?.flight_number || 'N/A'}</span>
                            </div>
                        </div>
                        <div style="margin-top: 10px;">
                            <a href="\${ticketUrl}" target="_blank" rel="noopener">View on Aviasales</a>
                        </div>
                    </div>
                \`;
                
                resultsDiv.innerHTML += ticketHtml;
            });
        }
        
        function formatDateForDisplay(date) {
            const options = { weekday: 'short', month: 'short', day: 'numeric' };
            return date.toLocaleDateString('en-US', options);
        }
        
        function getCurrencySymbol(currency) {
            switch(currency.toLowerCase()) {
                case 'usd': return '$';
                case 'eur': return '€';
                case 'cad': return 'C$';
                default: return '';
            }
        }
        
        async function testApi(endpoint) {
            const status = document.getElementById('apiStatus');
            status.innerHTML = \`<p>Testing \${endpoint}...</p>\`;
            
            try {
                const response = await fetch(endpoint);
                const data = await response.json();
                status.innerHTML = \`
                    <p style="color: green">✅ API is working</p>
                    <pre>\${JSON.stringify(data, null, 2)}</pre>
                \`;
                console.log('API test response:', data);
            } catch (error) {
                status.innerHTML = \`<p style="color: red">❌ API test failed: \${error.message}</p>\`;
                console.error('API test error:', error);
            }
        }
    </script>
</body>
</html>`; // Fix the template string syntax in build.js

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

// Verify that the public directory and index.html exist
if (fs.existsSync('public') && fs.existsSync(path.join('public', 'index.html'))) {
  console.log('Verified: public/index.html exists');
} else {
  console.error('Error: public/index.html is missing after build');
  process.exit(1);
}

// No need to copy public to dist and then back again
// Just make sure public directory has all the files we need

console.log('Build completed successfully!');





