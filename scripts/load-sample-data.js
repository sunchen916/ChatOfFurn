/**
 * Load Sample Amazon Data
 * 
 * Script to load sample Amazon furniture data into the knowledge base
 * Run: node scripts/load-sample-data.js
 */

const { loadSampleData } = require('../lib/sample-amazon-data');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function main() {
  log('\n📦 Loading Amazon Furniture Sample Data', 'bright');
  log('─'.repeat(50), 'cyan');
  
  try {
    const count = await loadSampleData();
    log(`\n✅ Success! Loaded ${count} products to knowledge base`, 'green');
  } catch (error) {
    log(`\n❌ Failed to load data: ${error.message}`, 'red');
    process.exit(1);
  }
}

main();
