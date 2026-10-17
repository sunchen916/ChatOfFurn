/**
 * API Route: Load Sample Data
 * 
 * POST /api/data/sample
 * Load sample Amazon furniture data into knowledge base
 */

import { NextRequest, NextResponse } from 'next/server';
import { loadSampleData } from '@/lib/sample-amazon-data';
import { getCollectionCount } from '@/lib/vector-store';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { clear = false } = body;

    console.log('[API /data/sample] Loading sample data...');
    console.log('[API /data/sample] Clear existing:', clear);

    // Get count before
    const countBefore = await getCollectionCount().catch(() => -1);

    // Load sample data
    const loaded = await loadSampleData();

    // Get count after
    const countAfter = await getCollectionCount().catch(() => -1);

    return NextResponse.json({
      success: true,
      data: {
        loaded,
        countBefore,
        countAfter,
        totalDocuments: countAfter
      },
      message: `Successfully loaded ${loaded} sample products`
    });

  } catch (error) {
    console.error('[API /data/sample] Error:', error);
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
  try {
    const count = await getCollectionCount().catch(() => -1);
    
    return NextResponse.json({
      success: true,
      data: {
        currentDocumentCount: count,
        availableSampleProducts: 30, // Number of sample products in sample-amazon-data.ts
        categories: [
          'Sofas & Couches',
          'Beds & Mattresses',
          'Dining Tables',
          'Office Chairs',
          'Desks',
          'Bookshelves & Storage',
          'Outdoor Furniture',
          'Dining Chairs'
        ]
      }
    });
  } catch (error) {
    console.error('[API /data/sample] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
