/**
 * Extended Tools for ReAct Agent
 * 
 * Additional tools beyond vector DB queries for comprehensive
 * furniture e-commerce assistance.
 */

import { Tool } from './react-agent';

/**
 * Tool definitions for extended capabilities
 */
export const EXTENDED_TOOLS: Tool[] = [
  {
    name: 'calculate_shipping',
    description: 'Calculate estimated shipping costs and logistics information for furniture products. Use when user asks about shipping costs, container loading, MOQ, or logistics calculations.',
    parameters: {
      type: 'object',
      properties: {
        product_dimensions: {
          type: 'object',
          description: 'Product dimensions in cm {length, width, height}',
          properties: {
            length: { type: 'number' },
            width: { type: 'number' },
            height: { type: 'number' }
          }
        },
        weight: {
          type: 'number',
          description: 'Product weight in kg'
        },
        destination: {
          type: 'string',
          description: 'Destination country or region (e.g., "USA", "Europe", "UK")'
        },
        quantity: {
          type: 'number',
          description: 'Order quantity'
        }
      }
    }
  },
  {
    name: 'check_regulations',
    description: 'Check import regulations, certifications, and compliance requirements for furniture in specific markets. Use when user asks about certifications (EPA, CARB, FSC), import restrictions, or compliance matters.',
    parameters: {
      type: 'object',
      properties: {
        product_type: {
          type: 'string',
          description: 'Type of furniture (e.g., "wooden furniture", "upholstered sofa", "children furniture")'
        },
        target_market: {
          type: 'string',
          description: 'Target market country or region'
        },
        material: {
          type: 'string',
          description: 'Primary material used'
        }
      },
      required: ['product_type', 'target_market']
    }
  },
  {
    name: 'analyze_listing',
    description: 'Analyze and suggest improvements for product listings. Use when user asks about listing optimization, copywriting, keyword suggestions, or how to improve product pages.',
    parameters: {
      type: 'object',
      properties: {
        product_name: {
          type: 'string',
          description: 'Current product name or title'
        },
        description: {
          type: 'string',
          description: 'Current product description'
        },
        target_market: {
          type: 'string',
          description: 'Target market or platform (e.g., "Amazon", "Etsy", "Shopify")'
        }
      },
      required: ['product_name']
    }
  },
  {
    name: 'estimate_profit',
    description: 'Calculate profit margins and cost breakdown for furniture products. Use when user asks about pricing strategy, profit margins, or cost analysis.',
    parameters: {
      type: 'object',
      properties: {
        product_cost: {
          type: 'number',
          description: 'Product cost in USD'
        },
        selling_price: {
          type: 'number',
          description: 'Expected selling price in USD'
        },
        shipping_cost: {
          type: 'number',
          description: 'Estimated shipping cost in USD'
        },
        platform_fee_percent: {
          type: 'number',
          description: 'Platform fee percentage (e.g., 15 for Amazon FBA)'
        }
      },
      required: ['product_cost', 'selling_price']
    }
  },
  {
    name: 'generate_keywords',
    description: 'Generate relevant keywords and search terms for furniture products. Use when user needs keyword research for SEO or advertising.',
    parameters: {
      type: 'object',
      properties: {
        product_category: {
          type: 'string',
          description: 'Product category (e.g., "sofa", "dining table", "office chair")'
        },
        target_market: {
          type: 'string',
          description: 'Target market country'
        },
        language: {
          type: 'string',
          description: 'Language for keywords (default: "en")'
        }
      },
      required: ['product_category']
    }
  },
  {
    name: 'compare_packaging',
    description: 'Compare different packaging options and their impact on shipping costs and product protection. Use when user asks about flat-pack vs fully assembled shipping, packaging materials, or container optimization.',
    parameters: {
      type: 'object',
      properties: {
        product_type: {
          type: 'string',
          description: 'Type of furniture'
        },
        options: {
          type: 'array',
          items: { type: 'string' },
          description: 'Packaging options to compare (e.g., ["flat-pack", "fully assembled", "knock-down"]'
        }
      },
      required: ['product_type', 'options']
    }
  }
];

/**
 * Execute extended tool by name
 */
export async function executeExtendedTool(
  toolName: string,
  params: Record<string, unknown>
): Promise<string> {
  switch (toolName) {
    case 'calculate_shipping': {
      const { product_dimensions, weight, destination, quantity = 1 } = params;
      
      // Basic shipping estimation logic
      const destRegion = getShippingRegion(destination as string);
      const baseRate = getBaseShippingRate(destRegion);
      
      // Calculate volume weight
      const volWeight = calculateVolumeWeight(
        product_dimensions as { length: number; width: number; height: number }
      );
      
      const chargeableWeight = Math.max(weight as number, volWeight);
      const totalCost = baseRate * chargeableWeight * (quantity as number);
      
      return JSON.stringify({
        destination: destination,
        region: destRegion,
        chargeable_weight_kg: chargeableWeight.toFixed(2),
        base_rate_per_kg: baseRate,
        quantity: quantity,
        estimated_shipping_cost_usd: totalCost.toFixed(2),
        cost_per_unit: (totalCost / (quantity as number)).toFixed(2),
        notes: getShippingNotes(destRegion)
      }, null, 2);
    }
    
    case 'check_regulations': {
      const { product_type, target_market, material } = params;
      const market = target_market as string;
      
      const regulations = getRegulationsForMarket(product_type as string, market, material as string);
      
      return JSON.stringify({
        product_type,
        target_market: market,
        regulations: regulations
      }, null, 2);
    }
    
    case 'analyze_listing': {
      const { product_name, description, target_market } = params;
      
      const analysis = analyzeListingQuality(
        product_name as string,
        description as string,
        target_market as string
      );
      
      return JSON.stringify(analysis, null, 2);
    }
    
    case 'estimate_profit': {
      const { product_cost, selling_price, shipping_cost = 0, platform_fee_percent = 15 } = params;
      
      const cost = product_cost as number;
      const price = selling_price as number;
      const shipping = shipping_cost as number;
      const feePercent = platform_fee_percent as number;
      
      const platformFee = price * (feePercent / 100);
      const totalCost = cost + shipping + platformFee;
      const profit = price - totalCost;
      const margin = (profit / price) * 100;
      
      return JSON.stringify({
        product_cost: cost,
        selling_price: price,
        shipping_cost: shipping,
        platform_fee_percent: feePercent,
        platform_fee_amount: platformFee.toFixed(2),
        total_cost: totalCost.toFixed(2),
        profit: profit.toFixed(2),
        profit_margin_percent: margin.toFixed(1),
        recommendation: getMarginRecommendation(margin)
      }, null, 2);
    }
    
    case 'generate_keywords': {
      const { product_category, target_market = 'US', language = 'en' } = params;
      
      const keywords = generateFurnitureKeywords(
        product_category as string,
        target_market as string,
        language as string
      );
      
      return JSON.stringify(keywords, null, 2);
    }
    
    case 'compare_packaging': {
      const { product_type, options } = params;
      
      const comparison = comparePackagingOptions(
        product_type as string,
        options as string[]
      );
      
      return JSON.stringify(comparison, null, 2);
    }
    
    default:
      return `Unknown tool: ${toolName}`;
  }
}

// Helper functions

function getShippingRegion(destination: string): string {
  const dest = destination.toLowerCase();
  if (dest.includes('usa') || dest.includes('us') || dest.includes('america')) return 'North America';
  if (dest.includes('uk') || dest.includes('britain') || dest.includes('england')) return 'UK';
  if (dest.includes('germany') || dest.includes('france') || dest.includes('europe') || dest.includes('eu')) return 'Europe';
  if (dest.includes('australia') || dest.includes('australia')) return 'Oceania';
  if (dest.includes('japan') || dest.includes('korea')) return 'Asia';
  return 'Other';
}

function getBaseShippingRate(region: string): number {
  const rates: Record<string, number> = {
    'North America': 2.5,
    'UK': 3.0,
    'Europe': 3.2,
    'Oceania': 3.5,
    'Asia': 2.0,
    'Other': 4.0
  };
  return rates[region] || 4.0;
}

function calculateVolumeWeight(dims: { length: number; width: number; height: number }): number {
  // Dimensional weight formula: (L x W x H) / 6000 for sea, / 5000 for air
  const volume = (dims.length * dims.width * dims.height) / 6000;
  return volume;
}

function getShippingNotes(region: string): string[] {
  const notes: Record<string, string[]> = {
    'North America': [
      '建议使用 FBA 或海运拼箱',
      '注意 EPA/CARB 认证要求',
      '提前确认清关所需文件'
    ],
    'UK': [
      'UKCA 标志要求',
      '注意 Brexit 后的新法规',
      '建议使用英国本地仓库'
    ],
    'Europe': [
      'CE 标志要求',
      'REACH 法规合规',
      'EPR 注册可能需要'
    ]
  };
  return notes[region] || ['请咨询当地物流代理获取详细信息'];
}

function getRegulationsForMarket(productType: string, market: string, material?: string): any {
  const productLower = productType.toLowerCase();
  const marketLower = market.toLowerCase();
  
  const regulations: any = {
    north_america: {
      certifications: ['CARB Phase 2', 'EPA TSCA Title VI'],
      if_wood: ['FSC 认证建议', '甲醛释放量限制'],
      if_upholstered: ['TB 117-2013', '加州Prop 65'],
      general: ['产品安全标准', '标签要求', '海关文件']
    },
    uk: {
      certifications: ['UKCA 标志', 'BS 标准'],
      if_wood: ['FSC/PEFC 认证'],
      general: ['UKCA 符合性声明', '产品安全文件']
    },
    europe: {
      certifications: ['CE 标志', 'EN 标准'],
      if_wood: ['FSC 认证', 'EUTR 法规'],
      general: ['REACH 法规', 'EPR 包装法', 'DoP 声明']
    }
  };
  
  let region = 'other';
  if (marketLower.includes('usa') || marketLower.includes('canada')) region = 'north_america';
  else if (marketLower.includes('uk')) region = 'uk';
  else if (marketLower.includes('germany') || marketLower.includes('france') || marketLower.includes('europe')) region = 'europe';
  
  const result = regulations[region] || { general: ['请咨询专业机构获取最新要求'] };
  
  // Add specific notes based on material
  if (material?.toLowerCase().includes('wood')) {
    return { ...result, material_specific: result.if_wood || [] };
  }
  
  return result;
}

function analyzeListingQuality(name: string, description: string, market: string): any {
  const issues: string[] = [];
  const suggestions: string[] = [];
  
  // Check title length
  if (name.length < 50) {
    issues.push('标题过短，建议包含更多关键词');
  }
  if (name.length > 200) {
    issues.push('标题过长，可能被平台截断');
  }
  
  // Check for key elements
  const keyElements = ['尺寸', '材质', '颜色', 'style', 'size', 'material'];
  const hasKeyElement = keyElements.some(el => name.toLowerCase().includes(el.toLowerCase()));
  if (!hasKeyElement) {
    suggestions.push('建议在标题中加入关键属性（尺寸、材质、颜色）');
  }
  
  // Check description
  if (description.length < 100) {
    issues.push('描述过于简单，建议增加详细内容');
  }
  
  // Generate suggestions based on market
  if (market?.toLowerCase().includes('amazon')) {
    suggestions.push('使用 Amazon SEO 最佳实践：品牌 + 核心词 + 属性 + 卖点');
    suggestions.push('考虑添加 A+ 内容增强转化率');
  }
  
  return {
    title_analysis: {
      length: name.length,
      has_key_elements: hasKeyElement,
      issues,
      score: Math.max(0, 100 - issues.length * 20)
    },
    description_analysis: {
      length: description?.length || 0,
      is_sufficient: (description?.length || 0) > 200
    },
    suggestions,
    platform_specific: market ? getPlatformTips(market) : null
  };
}

function getPlatformTips(platform: string): string[] {
  const platformLower = platform.toLowerCase();
  
  if (platformLower.includes('amazon')) {
    return [
      '标题限制 200 字符',
      '要点控制在 5 个',
      '搜索词最多 249 字节'
    ];
  }
  if (platformLower.includes('etsy')) {
    return [
      '标题最多 140 字符',
      '强调手工/定制特色',
      'SEO 关键词放在前面'
    ];
  }
  if (platformLower.includes('shopify') || platformLower.includes('独立站')) {
    return [
      '注重 SEO 关键词布局',
      '强调品牌故事',
      '高质量图片优先'
    ];
  }
  
  return ['优化产品标题和描述', '添加高质量图片', '使用相关关键词'];
}

function getMarginRecommendation(margin: number): string {
  if (margin < 10) return '⚠️ 利润率偏低，建议优化成本或提高售价';
  if (margin < 20) return '📊 利润率一般，有优化空间';
  if (margin < 35) return '✅ 利润率良好，业务可持续';
  return '🎉 利润率优秀，具竞争力';
}

function generateFurnitureKeywords(category: string, market: string, language: string): any {
  const categoryLower = category.toLowerCase();
  
  // Common furniture keywords
  const baseKeywords: Record<string, string[]> = {
    sofa: ['sofa', 'couch', 'loveseat', 'sectional', 'sofa set', 'living room furniture'],
    table: ['dining table', 'coffee table', 'side table', 'console table', 'writing desk'],
    chair: ['dining chair', 'office chair', 'accent chair', 'bar stool', 'recliner'],
    bed: ['bed frame', 'platform bed', 'upholstered bed', 'storage bed', 'metal bed'],
    storage: ['bookshelf', 'wardrobe', 'dresser', 'cabinet', 'TV stand', 'media console'],
    outdoor: ['outdoor furniture', 'patio set', 'garden furniture', 'rattan chair']
  };
  
  // Market-specific modifiers
  const marketModifiers: Record<string, string[]> = {
    us: ['modern', 'contemporary', 'farmhouse', 'mid-century', 'scandinavian'],
    uk: ['luxury', 'designer', 'premium', 'vintage', 'classic'],
    de: ['design', 'wohnzimmer', 'massivholz', 'eko'],
    fr: ['moderne', 'design', 'scandinave', 'industriel']
  };
  
  // Find matching category
  let keywords = baseKeywords['sofa']; // default
  for (const [key, kws] of Object.entries(baseKeywords)) {
    if (categoryLower.includes(key)) {
      keywords = kws;
      break;
    }
  }
  
  const modifiers = marketModifiers[market.toLowerCase()] || marketModifiers['us'];
  
  return {
    primary_keywords: keywords,
    modifiers: modifiers,
    long_tail: keywords.flatMap(kw => 
      modifiers.map(mod => `${mod} ${kw}`)
    ).slice(0, 15),
    negative_keywords: ['cheap', 'low quality', 'unbranded'], // For ad targeting
    language,
    market,
    tips: [
      '核心关键词放标题前面',
      '长尾词用于 SEO 和广告',
      '避免堆砌关键词'
    ]
  };
}

function comparePackagingOptions(productType: string, options: string[]): any {
  const optionDetails: Record<string, any> = {
    'flat-pack': {
      name: '平板包装',
      pros: ['运费节省 50-70%', '易于存储', '组装灵活', '适合跨境电商'],
      cons: ['需要客户组装', '可能影响体验', '包装材料成本'],
      suitable_for: ['独立站客户', 'FBA', '散货拼箱']
    },
    'fully-assembled': {
      name: '整装发货',
      pros: ['客户体验好', '开箱即可使用', '减少投诉'],
      cons: ['运费成本高', '仓储困难', '易损坏'],
      suitable_for: ['本地配送', '高客单价产品', '线下零售']
    },
    'knock-down': {
      name: ' knockdown（可拆装）',
      pros: ['介于平板和整装之间', '无需工具即可组装', '运输效率较高'],
      cons: ['连接件可能松动', '承重受限'],
      suitable_for: ['中档产品', '欧美市场', '多渠道销售']
    }
  };
  
  const comparisons = options.map(opt => {
    const key = opt.toLowerCase();
    for (const [k, detail] of Object.entries(optionDetails)) {
      if (key.includes(k) || k.includes(key)) {
        return detail;
      }
    }
    return { name: opt, info: '信息待补充' };
  });
  
  return {
    product_type: productType,
    options_compared: comparisons,
    recommendation: {
      for_fba: 'flat-pack',
      for_d2c: 'knock-down 或 fully-assembled',
      for_local: 'fully-assembled'
    }
  };
}

/**
 * Export all tools combined
 */
export function getAllTools(): Tool[] {
  return EXTENDED_TOOLS;
}
