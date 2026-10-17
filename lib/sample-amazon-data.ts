/**
 * Sample Amazon Furniture Data Generator
 * 
 * 生成示例家具数据用于测试知识库
 * 包含真实的产品结构和价格范围
 */

import { addDocuments } from './vector-store';
import { generateDocId } from './vector-store';
import { DocumentInput } from './vector-store';

// ============================================
// Sample Furniture Products
// ============================================

interface SampleProduct {
  asin: string;
  title: string;
  price: number;
  originalPrice?: number;
  rating: number;
  reviewCount: number;
  category: string;
  keywords: string[];
  badge?: string;
  prime: boolean;
}

const SAMPLE_PRODUCTS: SampleProduct[] = [
  // Sofas & Couches
  {
    asin: 'B08X8ZJ3GK',
    title: 'Modern Velvet Sofa Couch, 3-Seater L-Shaped Sectional with Chaise, Gray',
    price: 599.99,
    originalPrice: 799.99,
    rating: 4.5,
    reviewCount: 2847,
    category: 'Sofas & Couches',
    keywords: ['sofa', 'couch', 'sectional', 'velvet', 'modern'],
    badge: 'Best Seller',
    prime: true
  },
  {
    asin: 'B07Y8Y3W2N',
    title: 'Leather Recliner Sofa, 3 Seater with USB Ports, Dark Brown',
    price: 849.99,
    rating: 4.3,
    reviewCount: 1523,
    category: 'Sofas & Couches',
    keywords: ['sofa', 'leather', 'recliner', 'usb'],
    prime: true
  },
  {
    asin: 'B09K4Y2L8P',
    title: 'Mid-Century Modern Loveseat, 2-Seater Couch, Beige Linen',
    price: 349.99,
    originalPrice: 449.99,
    rating: 4.6,
    reviewCount: 987,
    category: 'Sofas & Couches',
    keywords: ['loveseat', 'mid-century', 'modern', 'linen'],
    badge: 'Hot New Release',
    prime: true
  },
  {
    asin: 'B08L5W7Y4K',
    title: 'Convertible Sleeper Sofa, 3-in-1 Sectional with Storage, Gray',
    price: 479.99,
    rating: 4.2,
    reviewCount: 3241,
    category: 'Sofas & Couches',
    keywords: ['sleeper', 'sofa', 'convertible', 'storage'],
    prime: true
  },

  // Beds & Mattresses
  {
    asin: 'B08N5Q7W3L',
    title: 'Upholstered Platform Bed Frame with Headboard, Queen Size, Gray',
    price: 259.99,
    originalPrice: 329.99,
    rating: 4.7,
    reviewCount: 4521,
    category: 'Beds & Mattresses',
    keywords: ['platform bed', 'headboard', 'upholstered', 'queen'],
    badge: 'Best Seller',
    prime: true
  },
  {
    asin: 'B07P8Q2Y3M',
    title: 'Solid Oak Wood Bed Frame, King Size, Natural Finish',
    price: 499.99,
    rating: 4.5,
    reviewCount: 876,
    category: 'Beds & Mattresses',
    keywords: ['oak', 'wood', 'bed', 'king'],
    prime: true
  },
  {
    asin: 'B09L4Y8W2K',
    title: 'Metal Bed Frame with Headboard, Full Size, Black',
    price: 159.99,
    rating: 4.4,
    reviewCount: 2156,
    category: 'Beds & Mattresses',
    keywords: ['metal', 'bed', 'frame', 'black'],
    prime: true
  },
  {
    asin: 'B08M4T8Y2N',
    title: 'Storage Bed with 4 Drawers, Queen Size, White',
    price: 329.99,
    originalPrice: 399.99,
    rating: 4.3,
    reviewCount: 1534,
    category: 'Beds & Mattresses',
    keywords: ['storage', 'bed', 'drawers', 'white'],
    prime: true
  },

  // Dining Tables
  {
    asin: 'B07Y2W3L8P',
    title: 'Extendable Dining Table, Seats 6-8, Solid Wood, Walnut',
    price: 449.99,
    originalPrice: 549.99,
    rating: 4.6,
    reviewCount: 2134,
    category: 'Dining Tables',
    keywords: ['dining table', 'extendable', 'wood', 'walnut'],
    badge: 'Best Seller',
    prime: true
  },
  {
    asin: 'B08N5L2W4Y',
    title: 'Modern Glass Top Dining Table with Metal Base, Seats 4',
    price: 299.99,
    rating: 4.4,
    reviewCount: 876,
    category: 'Dining Tables',
    keywords: ['glass', 'dining table', 'modern', 'metal'],
    prime: true
  },
  {
    asin: 'B09K3W8Y2L',
    title: 'Rustic Farmhouse Dining Table, Seats 6, Reclaimed Wood',
    price: 379.99,
    originalPrice: 479.99,
    rating: 4.7,
    reviewCount: 1654,
    category: 'Dining Tables',
    keywords: ['farmhouse', 'rustic', 'dining table', 'reclaimed wood'],
    prime: true
  },
  {
    asin: 'B08L7W2Y5K',
    title: 'Marble Top Dining Table Set, 5 Piece with Chairs',
    price: 699.99,
    rating: 4.2,
    reviewCount: 543,
    category: 'Dining Tables',
    keywords: ['marble', 'dining set', 'table', 'chairs'],
    prime: true
  },

  // Office Chairs
  {
    asin: 'B08N5Q2W7L',
    title: 'Ergonomic Office Chair with Lumbar Support, Mesh Back, Black',
    price: 249.99,
    originalPrice: 299.99,
    rating: 4.8,
    reviewCount: 8765,
    category: 'Office Chairs',
    keywords: ['office chair', 'ergonomic', 'mesh', 'lumbar'],
    badge: 'Best Seller',
    prime: true
  },
  {
    asin: 'B07Y8L2W4N',
    title: 'Gaming Chair with Footrest, Racing Style, RGB Lights',
    price: 199.99,
    rating: 4.5,
    reviewCount: 4521,
    category: 'Office Chairs',
    keywords: ['gaming chair', 'racing', 'footrest', 'rgb'],
    prime: true
  },
  {
    asin: 'B09K4W2Y8P',
    title: 'Leather Executive Office Chair, High Back, Comfortable',
    price: 349.99,
    originalPrice: 399.99,
    rating: 4.6,
    reviewCount: 2341,
    category: 'Office Chairs',
    keywords: ['executive', 'leather', 'office chair', 'high back'],
    prime: true
  },
  {
    asin: 'B08L5Q3Y2W',
    title: 'Standing Desk Converter, Height Adjustable, Dual Monitor',
    price: 179.99,
    rating: 4.4,
    reviewCount: 3214,
    category: 'Office Chairs',
    keywords: ['standing desk', 'adjustable', 'converter', 'monitor'],
    prime: true
  },

  // Desks
  {
    asin: 'B07Y2L8W3K',
    title: 'L-Shaped Computer Desk with Shelves, Home Office, Black',
    price: 199.99,
    originalPrice: 249.99,
    rating: 4.5,
    reviewCount: 5432,
    category: 'Desks',
    keywords: ['computer desk', 'l-shaped', 'shelves', 'home office'],
    badge: 'Best Seller',
    prime: true
  },
  {
    asin: 'B08N5W2Y4L',
    title: 'Modern Writing Desk, 47 Inch, Pine Wood, White',
    price: 149.99,
    rating: 4.3,
    reviewCount: 1876,
    category: 'Desks',
    keywords: ['writing desk', 'modern', 'pine', 'white'],
    prime: true
  },
  {
    asin: 'B09K3L2W8Y',
    title: 'Corner Desk with Drawers, Large Workstation, Walnut',
    price: 279.99,
    originalPrice: 329.99,
    rating: 4.6,
    reviewCount: 2543,
    category: 'Desks',
    keywords: ['corner desk', 'drawers', 'workstation', 'walnut'],
    prime: true
  },
  {
    asin: 'B08L7Q4Y2N',
    title: 'Electric Standing Desk, Height Adjustable, Memory Presets',
    price: 399.99,
    rating: 4.7,
    reviewCount: 1654,
    category: 'Desks',
    keywords: ['standing desk', 'electric', 'adjustable', 'memory'],
    badge: 'Hot New Release',
    prime: true
  },

  // Bookshelves & Storage
  {
    asin: 'B08N5L3W2K',
    title: 'Industrial Bookshelf, 5-Tier, Metal & Wood, rustic Brown',
    price: 129.99,
    originalPrice: 169.99,
    rating: 4.6,
    reviewCount: 6543,
    category: 'Bookshelves & Storage',
    keywords: ['bookshelf', 'industrial', '5-tier', 'metal wood'],
    badge: 'Best Seller',
    prime: true
  },
  {
    asin: 'B07Y8W2L4N',
    title: 'Cube Storage Organizer, 16 Cubes, White, DIY Assembly',
    price: 89.99,
    rating: 4.4,
    reviewCount: 4321,
    category: 'Bookshelves & Storage',
    keywords: ['cube storage', 'organizer', 'white', 'diy'],
    prime: true
  },
  {
    asin: 'B09K4Q8W3Y',
    title: 'Tall Corner Bookshelf, 5-Tier, Space Saving, Black',
    price: 109.99,
    rating: 4.5,
    reviewCount: 1876,
    category: 'Bookshelves & Storage',
    keywords: ['corner bookshelf', 'tall', 'space saving', 'black'],
    prime: true
  },
  {
    asin: 'B08L5N2Y7W',
    title: 'Floating Shelves Set of 3, Modern Wood Wall Mount',
    price: 39.99,
    rating: 4.7,
    reviewCount: 9876,
    category: 'Bookshelves & Storage',
    keywords: ['floating shelves', 'wall mount', 'modern', 'wood'],
    prime: true
  },

  // Outdoor Furniture
  {
    asin: 'B08N5W3L2K',
    title: 'Patio Conversation Set, 4-Piece Wicker Rattan Sofa, Beige',
    price: 499.99,
    originalPrice: 649.99,
    rating: 4.5,
    reviewCount: 1234,
    category: 'Outdoor Furniture',
    keywords: ['patio', 'wicker', 'rattan', 'outdoor sofa'],
    badge: 'Best Seller',
    prime: true
  },
  {
    asin: 'B07Y4L2W8N',
    title: 'Acacia Wood Outdoor Dining Set, Table + 4 Chairs, Natural',
    price: 599.99,
    rating: 4.4,
    reviewCount: 876,
    category: 'Outdoor Furniture',
    keywords: ['outdoor dining', 'acacia wood', 'table', 'chairs'],
    prime: true
  },
  {
    asin: 'B09K8W3Y2L',
    title: 'Adirondack Chair, Plastic Wood Composite, Weather Resistant',
    price: 149.99,
    originalPrice: 199.99,
    rating: 4.6,
    reviewCount: 2341,
    category: 'Outdoor Furniture',
    keywords: ['adirondack', 'chair', 'outdoor', 'weather resistant'],
    prime: true
  },
  {
    asin: 'B08L7N3Q5W',
    title: 'Umbrella Table Set, 9-Piece with 8 Chairs, Outdoor Dining',
    price: 399.99,
    rating: 4.3,
    reviewCount: 654,
    category: 'Outdoor Furniture',
    keywords: ['umbrella table', 'outdoor dining', 'patio set'],
    prime: true
  },

  // Dining Chairs
  {
    asin: 'B08N5L2W4K',
    title: 'Set of 2 Dining Chairs, Mid-Century Modern, Velvet, Gold Legs',
    price: 129.99,
    originalPrice: 159.99,
    rating: 4.7,
    reviewCount: 3214,
    category: 'Dining Chairs',
    keywords: ['dining chairs', 'mid-century', 'velvet', 'set of 2'],
    badge: 'Best Seller',
    prime: true
  },
  {
    asin: 'B07Y3W8L2N',
    title: 'Rustic Farmhouse Dining Chairs, Set of 4, Oak Wood',
    price: 199.99,
    rating: 4.5,
    reviewCount: 1876,
    category: 'Dining Chairs',
    keywords: ['farmhouse', 'dining chairs', 'oak', 'set of 4'],
    prime: true
  },
  {
    asin: 'B09K5W3Y2L',
    title: 'Bar Stools Set of 3, Modern Kitchen Counter Chairs, Adjustable',
    price: 149.99,
    rating: 4.4,
    reviewCount: 2543,
    category: 'Dining Chairs',
    keywords: ['bar stools', 'kitchen', 'counter', 'adjustable'],
    prime: true
  },
  {
    asin: 'B08L7Q4N3W',
    title: 'Leather Dining Chairs, Set of 4, Pu Leather, Black',
    price: 239.99,
    originalPrice: 299.99,
    rating: 4.6,
    reviewCount: 1432,
    category: 'Dining Chairs',
    keywords: ['dining chairs', 'leather', 'pu leather', 'set of 4'],
    prime: true
  },
];

// ============================================
// Transform to Knowledge Base Documents
// ============================================

function transformToDocuments(products: SampleProduct[]): DocumentInput[] {
  return products.map((product) => {
    const content = `
Product Name: ${product.title}
Category: ${product.category}
Price: $${product.price.toFixed(2)}
${product.originalPrice ? `Original Price: $${product.originalPrice.toFixed(2)}` : ''}
${product.price < (product.originalPrice || product.price) ? `Discount: ${Math.round((1 - product.price / (product.originalPrice || product.price)) * 100)}% OFF` : ''}
Rating: ${product.rating} out of 5 stars
Customer Reviews: ${product.reviewCount.toLocaleString()} reviews
${product.badge ? `Badge: ${product.badge}` : ''}
Prime Eligible: ${product.prime ? 'Yes' : 'No'}
ASIN: ${product.asin}
Product Tags: ${product.keywords.join(', ')}

Key Features:
- Category: ${product.category}
- Price Range: ${getPriceRange(product.price)}
- Rating Tier: ${getRatingTier(product.rating)}
- Review Volume: ${getReviewVolume(product.reviewCount)}

This is a ${product.rating >= 4.5 ? 'highly rated' : product.rating >= 4.0 ? 'well rated' : 'moderately rated'} ${product.category.toLowerCase()} product priced at $${product.price.toFixed(2)}${product.originalPrice ? ` (original price $${product.originalPrice.toFixed(2)})` : ''}.
`.trim();

    return {
      id: generateDocId(product.asin, 0),
      content,
      metadata: {
        source: 'amazon',
        sourceUrl: `https://www.amazon.com/dp/${product.asin}`,
        category: product.category,
        price: product.price,
        originalPrice: product.originalPrice,
        rating: product.rating,
        reviewCount: product.reviewCount,
        asin: product.asin,
        keywords: product.keywords,
        badge: product.badge,
        prime: product.prime,
        scrapedAt: new Date().toISOString(),
        type: 'amazon_product'
      }
    };
  });
}

// ============================================
// Helper Functions
// ============================================

function getPriceRange(price: number): string {
  if (price < 100) return 'Budget (Under $100)';
  if (price < 300) return 'Mid-Range ($100-$300)';
  if (price < 500) return 'Upper Mid ($300-$500)';
  if (price < 800) return 'Premium ($500-$800)';
  return 'Luxury ($800+)';
}

function getRatingTier(rating: number): string {
  if (rating >= 4.7) return 'Excellent (4.7+)';
  if (rating >= 4.5) return 'Very Good (4.5-4.6)';
  if (rating >= 4.0) return 'Good (4.0-4.4)';
  if (rating >= 3.5) return 'Average (3.5-3.9)';
  return 'Below Average (<3.5)';
}

function getReviewVolume(reviews: number): string {
  if (reviews >= 5000) return 'Very High (5000+)';
  if (reviews >= 2000) return 'High (2000-4999)';
  if (reviews >= 500) return 'Medium (500-1999)';
  if (reviews >= 100) return 'Low (100-499)';
  return 'Very Low (<100)';
}

// ============================================
// Main Function
// ============================================

export async function loadSampleData(): Promise<number> {
  console.log('[SampleData] Loading Amazon furniture sample data...');

  try {
    const documents = transformToDocuments(SAMPLE_PRODUCTS);
    
    console.log(`[SampleData] Generated ${documents.length} documents`);
    console.log(`[SampleData] Categories: ${[...new Set(SAMPLE_PRODUCTS.map(p => p.category))].join(', ')}`);
    
    // Add to knowledge base
    await addDocuments(documents);
    
    console.log(`[SampleData] ✓ Successfully loaded ${documents.length} products to knowledge base`);
    
    // Print summary
    console.log('\n[SampleData] Summary:');
    const categorySummary = SAMPLE_PRODUCTS.reduce((acc, p) => {
      acc[p.category] = (acc[p.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    Object.entries(categorySummary).forEach(([cat, count]) => {
      console.log(`  - ${cat}: ${count} products`);
    });
    
    return documents.length;
  } catch (error) {
    console.error('[SampleData] Error loading sample data:', error);
    throw error;
  }
}

// ============================================
// CLI Interface
// ============================================

if (require.main === module) {
  loadSampleData()
    .then(count => {
      console.log(`\n✓ Loaded ${count} sample products`);
      process.exit(0);
    })
    .catch(error => {
      console.error('Failed:', error);
      process.exit(1);
    });
}

// Export for use in other modules
export { SAMPLE_PRODUCTS };
