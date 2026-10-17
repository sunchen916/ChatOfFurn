'use client';

import { useState } from 'react';

interface ScrapeResult {
  success: boolean;
  data?: any[];
  error?: string;
  scrapedAt: string;
  source: string;
  category?: string;
}

interface Category {
  id: string;
  name: string;
  hasSubcategories: boolean;
}

export default function AmazonScraperPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<ScrapeResult[]>([]);
  const [currentJob, setCurrentJob] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [customKeywords, setCustomKeywords] = useState('');

  const categories: Category[] = [
    { id: 'furniture', name: 'All Furniture', hasSubcategories: true },
    { id: 'sofas', name: 'Sofas & Couches', hasSubcategories: false },
    { id: 'beds', name: 'Beds & Mattresses', hasSubcategories: false },
    { id: 'tables', name: 'Tables', hasSubcategories: false },
    { id: 'chairs', name: 'Chairs', hasSubcategories: false },
    { id: 'storage', name: 'Storage & Shelving', hasSubcategories: false },
  ];

  const startScrape = async (type: 'category' | 'keywords' | 'all') => {
    setIsLoading(true);
    setError(null);
    setResults([]);

    try {
      let body: any = { store: true };

      if (type === 'category' && selectedCategory) {
        setCurrentJob(`Scraping category: ${selectedCategory}`);
        body.category = selectedCategory;
      } else if (type === 'keywords' && customKeywords) {
        setCurrentJob(`Searching: ${customKeywords}`);
        body.keywords = customKeywords;
      } else {
        setCurrentJob('Scraping all furniture data...');
      }

      const response = await fetch('/api/scrape/amazon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await response.json();

      if (data.success) {
        if (Array.isArray(data.data)) {
          setResults(data.data);
        } else {
          setResults([data.data]);
        }
        setCurrentJob('Complete!');
      } else {
        setError(data.error || 'Unknown error occurred');
        setCurrentJob('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start scrape');
      setCurrentJob('');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            📦 Amazon Furniture Data Scraper
          </h1>
          <p className="text-gray-600">
            爬取亚马逊畅销榜单和家具数据，作为智能问答的权威信源
          </p>
        </div>

        {/* Status Card */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">爬虫状态</h2>
            <div className={`px-3 py-1 rounded-full text-sm ${
              isLoading 
                ? 'bg-yellow-100 text-yellow-800' 
                : 'bg-green-100 text-green-800'
            }`}>
              {isLoading ? '运行中...' : '空闲'}
            </div>
          </div>

          {currentJob && (
            <div className="mb-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-blue-800">{currentJob}</p>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 rounded-lg">
              <p className="text-red-800">错误: {error}</p>
            </div>
          )}

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <button
              onClick={() => startScrape('all')}
              disabled={isLoading}
              className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              🚀 爬取全部数据
            </button>
            
            <button
              onClick={() => startScrape('category')}
              disabled={isLoading || !selectedCategory}
              className="px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              📂 爬取选中类别
            </button>

            <button
              onClick={() => startScrape('keywords')}
              disabled={isLoading || !customKeywords}
              className="px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              🔍 自定义搜索
            </button>
          </div>

          {/* Category Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              选择类别
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                    selectedCategory === cat.id
                      ? 'bg-blue-100 text-blue-800 border-2 border-blue-500'
                      : 'bg-gray-100 text-gray-700 border-2 border-transparent hover:bg-gray-200'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Keywords */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              自定义搜索关键词
            </label>
            <input
              type="text"
              value={customKeywords}
              onChange={(e) => setCustomKeywords(e.target.value)}
              placeholder="例如: modern leather sofa, ergonomic office chair..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Results Section */}
        {results.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              爬取结果 ({results.length} 个类别)
            </h2>

            {results.map((result, idx) => (
              <div key={idx} className="mb-6 border-b border-gray-200 pb-6 last:border-b-0">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-medium text-gray-900">
                      {result.source} - {result.category || 'General'}
                    </h3>
                    <p className="text-sm text-gray-500">
                      爬取时间: {new Date(result.scrapedAt).toLocaleString('zh-CN')}
                    </p>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-sm ${
                    result.success 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {result.success ? '成功' : '失败'}
                  </div>
                </div>

                {result.success && result.data && (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-600">
                      共获取 <span className="font-semibold text-blue-600">{result.data.length}</span> 个产品
                    </p>
                    
                    <div className="grid gap-3">
                      {result.data.slice(0, 10).map((product: any, pIdx: number) => (
                        <div 
                          key={pIdx}
                          className="flex items-start gap-4 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          {product.imageUrl && (
                            <img 
                              src={product.imageUrl} 
                              alt={product.title}
                              className="w-16 h-16 object-cover rounded"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 truncate">
                              {product.title}
                            </p>
                            <div className="flex items-center gap-4 mt-1 text-sm">
                              <span className="text-green-600 font-semibold">
                                ${product.price?.toFixed(2) || 'N/A'}
                              </span>
                              {product.rating && (
                                <span className="text-yellow-600">
                                  ⭐ {product.rating}/5
                                </span>
                              )}
                              {product.reviewCount > 0 && (
                                <span className="text-gray-500">
                                  {product.reviewCount.toLocaleString()} reviews
                                </span>
                              )}
                              {product.badge && (
                                <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs">
                                  {product.badge}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-400 mt-1 truncate">
                              ASIN: {product.asin}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {result.data.length > 10 && (
                      <p className="text-sm text-gray-500 text-center">
                        ... 还有 {result.data.length - 10} 个产品未显示
                      </p>
                    )}
                  </div>
                )}

                {!result.success && result.error && (
                  <p className="text-red-600">错误: {result.error}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Info Card */}
        <div className="mt-6 bg-blue-50 rounded-xl p-6">
          <h3 className="font-semibold text-blue-900 mb-2">📚 数据源说明</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• 数据来源: Amazon.com 畅销榜单 (Best Sellers)</li>
            <li>• 包含类别: 沙发、床、桌子、椅子、储物等家具</li>
            <li>• 数据内容: 产品名称、价格、评分、评论数、图片</li>
            <li>• 更新频率: 建议每周爬取一次以保持数据新鲜</li>
            <li>• 存储位置: 向量知识库，用于 RAG 智能问答</li>
          </ul>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>⚠️ 请合理控制爬取频率，遵守 Amazon 服务条款</p>
        </div>
      </div>
    </div>
  );
}
