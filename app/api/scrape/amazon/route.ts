/**
 * API Route: Scrape Amazon Furniture Data
 * 
 * POST /api/scrape/amazon
 * 
 * Trigger the Amazon scraper to fetch furniture data and store in knowledge base
 * 
 * Body parameters:
 * - keywords: string (optional) - specific keywords to search
 * - category: string (optional) - specific category to scrape
 * - store: boolean (default: true) - whether to store in knowledge base
 */

import { NextRequest, NextResponse } from 'next/server';
import { scrapeAndStore, scrapeAllFurnitureData, AmazonFurnitureScraper, FURNITURE_CATEGORIES } from '@/lib/amazon-scraper';

// Disable buffering for streaming responses
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { keywords, category, store = true } = body;

    console.log('[API /scrape/amazon] Starting scrape job');
    console.log('[API /scrape/amazon] Keywords:', keywords);
    console.log('[API /scrape/amazon] Category:', category);
    console.log('[API /scrape/amazon] Store:', store);

    let result;

    if (keywords) {
      // Search for specific keywords
      result = await scrapeAndStore(keywords, store);
    } else if (category) {
      // Find category URL
      const catConfig = FURNITURE_CATEGORIES.find(c => c.categoryId === category);
      if (catConfig) {
        const scraper = new AmazonFurnitureScraper();
        await scraper.initialize();
        result = await scraper.scrapeBestsellers(catConfig.url);
        await scraper.close();
        result.category = catConfig.name;
      } else {
        return NextResponse.json(
          { success: false, error: `Category not found: ${category}` },
          { status: 404 }
        );
      }
    } else {
      // Scrape all furniture data
      result = await scrapeAllFurnitureData();
    }

    return NextResponse.json({
      success: true,
      data: result,
      message: 'Scraping completed successfully'
    });

  } catch (error) {
    console.error('[API /scrape/amazon] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  // Return available categories and instructions
  return NextResponse.json({
    endpoints: {
      'POST /api/scrape/amazon': 'Trigger scrape job',
      body: {
        keywords: 'string (optional) - Search for specific keywords',
        category: 'string (optional) - Category ID to scrape',
        store: 'boolean (default: true) - Store in knowledge base'
      }
    },
    availableCategories: FURNITURE_CATEGORIES.map(c => ({
      id: c.categoryId,
      name: c.name,
      hasSubcategories: !!c.subcategories
    })),
    examples: {
      scrapeAll: {
        method: 'POST',
        url: '/api/scrape/amazon',
        body: {}
      },
      searchKeywords: {
        method: 'POST',
        url: '/api/scrape/amazon',
        body: { keywords: 'modern sofa leather' }
      },
      scrapeCategory: {
        method: 'POST',
        url: '/api/scrape/amazon',
        body: { category: 'sofas' }
      }
    }
  });
}
