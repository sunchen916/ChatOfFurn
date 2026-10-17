# Amazon Furniture Data Scraper

## 概述

这是一个专门用于爬取亚马逊家具数据的模块，为智能家具问答系统提供权威数据源。

## 功能特性

- 🕷️ **爬取畅销榜单** - 亚马逊 Best Sellers 各类别
- 🔍 **关键词搜索** - 自定义关键词搜索产品
- 📊 **多类别支持** - 沙发、床、桌子、椅子、储物、户外家具等
- 💾 **知识库集成** - 自动存储到向量知识库用于 RAG
- ⚡ **请求限制** - 内置速率限制，避免被封禁
- 🔄 **重试机制** - 失败自动重试

## 快速开始

### 1. 加载示例数据（无需爬虫）

```bash
# 加载预置的30个示例产品
npm run data:sample
```

这将加载包含以下类别的示例数据：
- Sofas & Couches (沙发)
- Beds & Mattresses (床)
- Dining Tables (餐桌)
- Office Chairs (办公椅)
- Desks (书桌)
- Bookshelves & Storage (书架和储物)
- Outdoor Furniture (户外家具)
- Dining Chairs (餐椅)

### 2. 爬取真实数据

```bash
# 爬取畅销榜单
npm run scrape:bestsellers

# 搜索特定产品
npm run scrape:search "modern leather sofa"

# 爬取所有类别
npm run scrape:all

# 爬取并存储到知识库
npm run scrape:store
```

### 3. 使用爬虫管理页面

访问 `/scrape/amazon` 或 `/data` 页面查看爬虫状态和管理界面。

## API 端点

### POST /api/scrape/amazon

触发爬虫任务。

**参数：**
```json
{
  "keywords": "modern sofa",    // 可选：搜索关键词
  "category": "sofas",          // 可选：类别ID
  "store": true                // 可选：是否存储到知识库，默认 true
}
```

**示例：**
```bash
# 爬取畅销榜单
curl -X POST http://localhost:3000/api/scrape/amazon -H "Content-Type: application/json" -d '{}'

# 搜索关键词
curl -X POST http://localhost:3000/api/scrape/amazon -H "Content-Type: application/json" -d '{"keywords": "ergonomic office chair"}'

# 爬取特定类别
curl -X POST http://localhost:3000/api/scrape/amazon -H "Content-Type: application/json" -d '{"category": "sofas"}'
```

### GET /api/scrape/amazon

获取可用类别列表。

### POST /api/data/sample

加载示例数据。

**参数：**
```json
{
  "clear": false  // 可选：是否清除现有数据
}
```

### GET /api/data/sample

获取数据统计。

## 可用类别

| ID | 名称 | 关键词 |
|----|------|--------|
| `furniture` | All Furniture | furniture |
| `sofas` | Sofas & Couches | sofa, couch, loveseat, sectional |
| `beds` | Beds & Mattresses | bed, mattress, platform bed |
| `tables` | Tables | dining table, coffee table |
| `chairs` | Chairs | office chair, dining chair |
| `storage` | Storage & Shelving | bookshelf, cabinet, storage |

## 数据格式

爬取的数据会转换为以下格式存入知识库：

```typescript
{
  id: string;           // 唯一ID
  content: string;      // 产品信息文本
  metadata: {
    source: 'amazon';
    sourceUrl: string;  // 亚马逊产品链接
    category: string;  // 产品类别
    price: number;      // 当前价格
    originalPrice?: number; // 原价（如果打折）
    rating: number;     // 评分 0-5
    reviewCount: number; // 评论数
    asin: string;       // 亚马逊ASIN
    keywords: string[]; // 产品标签
    badge?: string;     // 标签（Best Seller等）
    prime: boolean;     // 是否Prime
    scrapedAt: string;  // 爬取时间
  }
}
```

## 反爬虫策略

为避免被亚马逊封禁，爬虫实现了以下策略：

1. **请求限流** - 每请求间隔 3 秒
2. **User-Agent 轮换** - 随机使用不同的浏览器标识
3. **自动滚动** - 模拟真实用户滚动页面
4. **错误重试** - 失败自动重试最多 3 次
5. **超时设置** - 30 秒页面加载超时

## 合规说明

⚠️ **重要**：请确保使用爬虫时遵守以下规则：

1. 仅爬取公开可访问的数据
2. 遵守亚马逊的服务条款
3. 不要过于频繁地请求（建议间隔 3-5 秒）
4. 仅用于个人学习或研究目的
5. 商业使用请考虑使用官方 API 或数据服务商

## 故障排除

### 爬虫请求失败

如果爬虫请求失败，可能原因：
- 亚马逊反爬虫机制触发（IP被封）
- 网络连接问题
- 页面结构变化

**解决方案：**
1. 等待几分钟后重试
2. 使用 VPN 更换 IP
3. 使用示例数据作为替代

### 知识库存储失败

检查向量数据库是否正常运行：
- Supabase: 检查 pgvector 扩展是否启用
- Chroma: 检查服务是否启动

## 文件结构

```
lib/
├── amazon-scraper.ts      # 核心爬虫模块
├── sample-amazon-data.ts   # 示例数据
└── ...

scripts/
├── amazon-scraper.js      # CLI 工具
└── load-sample-data.js    # 加载示例数据

app/
├── api/
│   ├── scrape/amazon/    # 爬虫 API
│   └── data/sample/      # 数据管理 API
├── scrape/amazon/        # 爬虫管理页面
└── data/                 # 数据管理页面
```

## 技术栈

- **Puppeteer** - 无头浏览器，用于渲染 JavaScript
- **向量数据库** - 存储嵌入向量（Supabase pgvector / Chroma）
- **RAG** - 检索增强生成，用于 AI 问答

## 扩展

如需扩展爬虫功能，可以：

1. 添加更多产品类别
2. 爬取评论数据
3. 追踪价格变化历史
4. 集成其他电商平台

---

**注意**：本工具仅供学习和研究使用，请遵守各平台的服务条款。
