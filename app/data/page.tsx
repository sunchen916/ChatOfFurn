'use client';

import { useState, useEffect } from 'react';

interface DataStats {
  currentDocumentCount: number;
  availableSampleProducts: number;
  categories: string[];
}

interface ScrapeResult {
  success: boolean;
  data?: any[];
  message?: string;
  error?: string;
}

export default function DataManagementPage() {
  const [stats, setStats] = useState<DataStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [isLoadingSample, setIsLoadingSample] = useState(false);
  const [isScraping, setIsScraping] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [scrapeProgress, setScrapeProgress] = useState<string>('');

  // Fetch stats on mount
  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/data/sample');
      const data = await response.json();
      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setIsLoadingStats(false);
    }
  };

  const loadSampleData = async () => {
    setIsLoadingSample(true);
    setMessage(null);

    try {
      const response = await fetch('/api/data/sample', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clear: false })
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: `✅ ${data.message}！文档总数: ${data.data.totalDocuments}` });
        fetchStats();
      } else {
        setMessage({ type: 'error', text: `❌ 加载失败: ${data.error}` });
      }
    } catch (error) {
      setMessage({ type: 'error', text: '❌ 网络错误，请重试' });
    } finally {
      setIsLoadingSample(false);
    }
  };

  const scrapeAmazon = async () => {
    setIsScraping(true);
    setMessage(null);
    setScrapeProgress('正在初始化爬虫...');

    try {
      const response = await fetch('/api/scrape/amazon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store: true })
      });

      const data = await response.json();

      if (data.success) {
        const totalProducts = Array.isArray(data.data) 
          ? data.data.reduce((sum: number, r: any) => sum + (r.data?.length || 0), 0)
          : (data.data?.data?.length || 0);
        
        setMessage({ type: 'success', text: `✅ 爬取完成！获取 ${totalProducts} 个产品并存储到知识库` });
        fetchStats();
      } else {
        setMessage({ type: 'error', text: `❌ 爬取失败: ${data.error}` });
      }
    } catch (error) {
      setMessage({ type: 'error', text: '❌ 网络错误，请重试' });
    } finally {
      setIsScraping(false);
      setScrapeProgress('');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            📊 知识库数据管理
          </h1>
          <p className="text-gray-600">
            管理亚马逊家具数据源，包括示例数据和爬虫数据
          </p>
        </div>

        {/* Message Display */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          }`}>
            {message.text}
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-sm font-medium text-gray-500 mb-1">当前文档数</h3>
            <p className="text-3xl font-bold text-gray-900">
              {isLoadingStats ? '...' : stats?.currentDocumentCount ?? 0}
            </p>
            <p className="text-sm text-gray-500 mt-2">知识库中的文档总数</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-sm font-medium text-gray-500 mb-1">可用示例数据</h3>
            <p className="text-3xl font-bold text-blue-600">
              {isLoadingStats ? '...' : stats?.availableSampleProducts ?? 0}
            </p>
            <p className="text-sm text-gray-500 mt-2">预置的亚马逊产品数据</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-sm font-medium text-gray-500 mb-1">数据类别</h3>
            <p className="text-3xl font-bold text-purple-600">
              {isLoadingStats ? '...' : stats?.categories?.length ?? 0}
            </p>
            <p className="text-sm text-gray-500 mt-2">涵盖的家具品类</p>
          </div>
        </div>

        {/* Actions */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">数据操作</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Sample Data */}
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-medium text-gray-900">📦 加载示例数据</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    加载预置的30个亚马逊家具产品数据
                  </p>
                </div>
                <button
                  onClick={loadSampleData}
                  disabled={isLoadingSample}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoadingSample ? '加载中...' : '加载'}
                </button>
              </div>

              {stats?.categories && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {stats.categories.map((cat) => (
                    <span key={cat} className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                      {cat}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Amazon Scraper */}
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-medium text-gray-900">🕷️ 爬取亚马逊数据</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    实时爬取亚马逊畅销榜单数据
                  </p>
                </div>
                <button
                  onClick={scrapeAmazon}
                  disabled={isScraping}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isScraping ? '爬取中...' : '开始爬取'}
                </button>
              </div>

              {scrapeProgress && (
                <p className="text-sm text-blue-600 mt-2">{scrapeProgress}</p>
              )}

              <div className="mt-3 p-2 bg-yellow-50 rounded text-xs text-yellow-700">
                ⚠️ 爬取可能需要几分钟，请耐心等待
              </div>
            </div>
          </div>
        </div>

        {/* Categories Detail */}
        {stats?.categories && (
          <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">数据覆盖的家具类别</h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {stats.categories.map((category) => (
                <div key={category} className="p-3 bg-gray-50 rounded-lg">
                  <p className="font-medium text-gray-700">{category}</p>
                  <p className="text-xs text-gray-500 mt-1">示例产品: 3-4个</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Data Flow */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">数据流向</h2>

          <div className="flex items-center justify-between overflow-x-auto">
            <div className="flex items-center space-x-4">
              {/* Source */}
              <div className="text-center min-w-[120px]">
                <div className="w-16 h-16 bg-orange-100 rounded-lg flex items-center justify-center mb-2 mx-auto">
                  <span className="text-2xl">🕷️</span>
                </div>
                <p className="text-sm font-medium text-gray-700">亚马逊</p>
                <p className="text-xs text-gray-500">数据源</p>
              </div>

              {/* Arrow */}
              <div className="text-gray-300">→</div>

              {/* Scraper */}
              <div className="text-center min-w-[120px]">
                <div className="w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center mb-2 mx-auto">
                  <span className="text-2xl">⚙️</span>
                </div>
                <p className="text-sm font-medium text-gray-700">爬虫模块</p>
                <p className="text-xs text-gray-500">数据采集</p>
              </div>

              {/* Arrow */}
              <div className="text-gray-300">→</div>

              {/* Knowledge Base */}
              <div className="text-center min-w-[120px]">
                <div className="w-16 h-16 bg-green-100 rounded-lg flex items-center justify-center mb-2 mx-auto">
                  <span className="text-2xl">🧠</span>
                </div>
                <p className="text-sm font-medium text-gray-700">知识库</p>
                <p className="text-xs text-gray-500">向量存储</p>
              </div>

              {/* Arrow */}
              <div className="text-gray-300">→</div>

              {/* AI Chat */}
              <div className="text-center min-w-[120px]">
                <div className="w-16 h-16 bg-purple-100 rounded-lg flex items-center justify-center mb-2 mx-auto">
                  <span className="text-2xl">💬</span>
                </div>
                <p className="text-sm font-medium text-gray-700">AI 问答</p>
                <p className="text-xs text-gray-500">RAG 应用</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>💡 提示: 示例数据适合测试，真实使用建议定期爬取亚马逊最新数据</p>
        </div>
      </div>
    </div>
  );
}
