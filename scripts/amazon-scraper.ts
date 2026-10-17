#!/usr/bin/env node

/**
 * Amazon Furniture Scraper CLI
 * 
 * 命令行工具用于爬取亚马逊家具数据
 */

import { scrapeAndStore, scrapeAllFurnitureData, AmazonFurnitureScraper, FURNITURE_CATEGORIES } from '../lib/amazon-scraper';

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0] || 'help';
const param = args.slice(1).join(' ');

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

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message: string) {
  log(`✓ ${message}`, 'green');
}

function logError(message: string) {
  log(`✗ ${message}`, 'red');
}

function logInfo(message: string) {
  log(`ℹ ${message}`, 'blue');
}

function logWarning(message: string) {
  log(`⚠ ${message}`, 'yellow');
}

// Help text
function showHelp() {
  log('\n📦 Amazon Furniture Scraper CLI', 'bright');
  log('─'.repeat(50), 'cyan');
  log('\nUsage:', 'bright');
  log('  node scripts/amazon-scraper.ts <command> [options]\n');
  log('Commands:', 'bright');
  log('  bestsellers [category]  - 爬取亚马逊畅销榜单');
  log('  search <keywords>        - 搜索并爬取产品');
  log('  all                      - 爬取所有家具类别');
  log('  store                    - 爬取并存储到知识库');
  log('  list                     - 列出所有可用类别');
  log('  help                     - 显示帮助信息\n');
  log('Options:', 'bright');
  log('  --dry-run                - 仅测试，不实际爬取');
  log('  --verbose                - 显示详细输出\n');
  log('Examples:', 'bright');
  log('  npx ts-node scripts/amazon-scraper.ts bestsellers');
  log('  npx ts-node scripts/amazon-scraper.ts search "modern sofa"');
  log('  npx ts-node scripts/amazon-scraper.ts all --verbose');
  log('  npx ts-node scripts/amazon-scraper.ts store\n');
}

// List categories
function listCategories() {
  log('\n📂 Available Furniture Categories', 'bright');
  log('─'.repeat(50), 'cyan');
  
  FURNITURE_CATEGORIES.forEach(cat => {
    log(`\n  ${cat.categoryId}: ${cat.name}`, 'yellow');
    if (cat.keywords) {
      log(`    Keywords: ${cat.keywords.join(', ')}`, 'reset');
    }
    if (cat.subcategories) {
      log(`    Subcategories:`, 'reset');
      cat.subcategories.forEach(sub => {
        log(`      - ${sub.name}`, 'reset');
      });
    }
  });
  
  console.log();
}

// Main execution
async function main() {
  const isVerbose = args.includes('--verbose');
  const isDryRun = args.includes('--dry-run');

  try {
    switch (command) {
      case 'help':
        showHelp();
        break;

      case 'list':
        listCategories();
        break;

      case 'bestsellers': {
        if (isDryRun) {
          logInfo('Dry run mode - would scrape bestsellers');
          break;
        }
        
        logInfo('Starting bestsellers scrape...');
        
        const scraper = new AmazonFurnitureScraper();
        await scraper.initialize();
        
        // Find category if specified
        let categoryUrl: string | undefined;
        if (param) {
          const cat = FURNITURE_CATEGORIES.find(c => 
            c.categoryId === param || c.name.toLowerCase().includes(param.toLowerCase())
          );
          categoryUrl = cat?.url;
        }
        
        const result = await scraper.scrapeBestsellers(categoryUrl);
        await scraper.close();
        
        if (result.success) {
          logSuccess(`Scraped ${result.data?.length || 0} products`);
          if (isVerbose && result.data) {
            console.log('\nTop 5 Products:');
            result.data.slice(0, 5).forEach((p, i) => {
              console.log(`  ${i + 1}. ${p.title.substring(0, 60)}...`);
              console.log(`     Price: $${p.price?.toFixed(2) || 'N/A'} | Rating: ${p.rating || 'N/A'}/5`);
            });
          }
        } else {
          logError(`Failed: ${result.error}`);
        }
        break;
      }

      case 'search': {
        if (!param) {
          logError('Please provide search keywords');
          log('Usage: npx ts-node scripts/amazon-scraper.ts search <keywords>');
          process.exit(1);
        }
        
        if (isDryRun) {
          logInfo(`Dry run mode - would search for: ${param}`);
          break;
        }
        
        logInfo(`Searching for: ${param}`);
        
        const searchResult = await scrapeAndStore(param, false); // Don't store in dry run
        
        if (searchResult.success) {
          logSuccess(`Found ${searchResult.data?.length || 0} products`);
          if (isVerbose && searchResult.data) {
            console.log('\nResults:');
            searchResult.data.slice(0, 10).forEach((p, i) => {
              console.log(`  ${i + 1}. ${p.title.substring(0, 70)}`);
              console.log(`     Price: $${p.price?.toFixed(2) || 'N/A'} | Reviews: ${p.reviewCount.toLocaleString()}`);
            });
          }
        } else {
          logError(`Search failed: ${searchResult.error}`);
        }
        break;
      }

      case 'all': {
        if (isDryRun) {
          logInfo(`Dry run mode - would scrape all ${FURNITURE_CATEGORIES.length} categories`);
          break;
        }
        
        logInfo('Starting full furniture data scrape...');
        logWarning('This may take several minutes...\n');
        
        const scraper2 = new AmazonFurnitureScraper();
        await scraper2.initialize();
        
        let totalProducts = 0;
        
        for (const category of FURNITURE_CATEGORIES) {
          logInfo(`Scraping: ${category.name}...`);
          
          if (category.url) {
            const result = await scraper2.scrapeBestsellers(category.url);
            if (result.success) {
              totalProducts += result.data?.length || 0;
              logSuccess(`  Got ${result.data?.length || 0} products`);
            } else {
              logWarning(`  Failed: ${result.error}`);
            }
          }
          
          // Rate limiting
          await new Promise(r => setTimeout(r, 3000));
        }
        
        await scraper2.close();
        logSuccess(`\nTotal products scraped: ${totalProducts}`);
        break;
      }

      case 'store': {
        if (isDryRun) {
          logInfo('Dry run mode - would scrape and store to knowledge base');
          break;
        }
        
        logInfo('Scraping all furniture data and storing to knowledge base...');
        logWarning('This may take 5-10 minutes...\n');
        
        const startTime = Date.now();
        const results = await scrapeAllFurnitureData();
        const endTime = Date.now();
        
        const storedProducts = results.reduce((sum, r) => sum + (r.data?.length || 0), 0);
        
        logSuccess(`\nCompleted!`);
        log(`  Total products: ${storedProducts}`, 'reset');
        log(`  Categories scraped: ${results.length}`, 'reset');
        log(`  Time elapsed: ${((endTime - startTime) / 1000).toFixed(1)}s`, 'reset');
        break;
      }

      default:
        logError(`Unknown command: ${command}`);
        console.log();
        showHelp();
        process.exit(1);
    }
  } catch (error: any) {
    logError(`Error: ${error.message}`);
    if (isVerbose) {
      console.error(error);
    }
    process.exit(1);
  }
  
  process.exit(0);
}

// Run main function
main();
