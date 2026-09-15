# Web Search Tools 使用文档

## 概述

Web Search Tools 是 ChaTofFun Agent 的扩展工具集，提供实时网络搜索能力，包括家具价格查询、热榜趋势分析等功能。

## 可用工具

### 1. search_furniture_price - 家具价格搜索

在主流电商平台上搜索家具价格。

**参数：**
- `product_name` (必需): 产品名称，如 "modern leather sofa"
- `platform` (可选): 平台选择 ("amazon", "wayfair", "ikea", "all")
- `price_range_min` (可选): 最低价格（美元）
- `price_range_max` (可选): 最高价格（美元）
- `limit` (可选): 返回结果数量（默认 10）

**使用示例：**
```
搜索 "modern velvet sofa" 在所有平台的价格
搜索 "office chair" 在 Amazon 上的价格，预算 $100-300
```

**返回数据：**
- 各平台价格列表
- 价格统计（最低、最高、平均、中位数）
- 产品评分和评价数
- 搜索时间戳

---

### 2. get_trending_furniture - 热门家具查询

获取当前流行的家具款式和趋势。

**参数：**
- `category` (可选): 家具类别 ("living_room", "bedroom", "dining", "office", "outdoor", "all")
- `source` (可选): 数据来源 ("amazon", "google_trends", "pinterest", "all")
- `timeframe` (可选): 时间范围 ("day", "week", "month", "year")
- `limit` (可选): 返回数量（默认 10）

**使用示例：**
```
查询本月最热门的客厅家具
获取 Amazon 卧室家具畅销榜
查看 Pinterest 上的户外家具趋势
```

**返回数据：**
- Google Trends 搜索趋势
- Amazon 畅销榜产品
- Pinterest 热门创意
- 趋势洞察和建议

---

### 3. search_market_trends - 市场趋势搜索

搜索家具行业市场趋势和洞察。

**参数：**
- `topic` (必需): 趋势主题，如 "sustainable furniture"
- `region` (可选): 地区 ("usa", "europe", "asia", "global")
- `include_reports` (可选): 是否包含市场报告（默认 true）

**使用示例：**
```
搜索可持续家具市场趋势
查询美国市场智能家居家具趋势
搜索极简设计风格趋势
```

**返回数据：**
- 相关搜索结果
- 市场概览
- 增长驱动因素
- 面临挑战
- 市场报告摘要

---

### 4. get_bestseller_analysis - 畅销分析

获取特定家具类别的畅销品分析。

**参数：**
- `category` (必需): 家具类别，如 "sofa"
- `marketplace` (可选): 市场平台 ("amazon", "wayfair", "etsy", "all")
- `include_reviews` (可选): 是否包含用户评价洞察（默认 false）

**使用示例：**
```
分析 Amazon 上最畅销的沙发
获取办公椅畅销品分析，包含评价洞察
分析 Wayfair 餐桌畅销品
```

**返回数据：**
- Top 畅销产品列表
- 共同特征分析
- 价格区间分布
- 成功因素分析
- 用户评价洞察（可选）

---

### 5. compare_marketplace_prices - 多平台价格对比

在不同电商平台间对比同一产品的价格。

**参数：**
- `product_keywords` (必需): 产品关键词
- `marketplaces` (可选): 平台列表（默认 ["amazon", "wayfair"]）

**使用示例：**
```
对比 "ergonomic office chair" 在各平台的价格
对比 "queen size bed frame" 在 Amazon、Walmart、Target 的价格
```

**返回数据：**
- 各平台搜索结果
- 最低价/最高价对比
- 最佳优惠推荐
- 价格差异分析

---

## 使用场景

### 场景 1: 选品调研
```
用户: "我想了解目前美国市场最受欢迎的沙发类型和价格区间"

Agent 将使用:
1. get_trending_furniture (category: living_room, source: amazon)
2. search_furniture_price (product_name: sofa, platform: amazon)
```

### 场景 2: 竞品分析
```
用户: "帮我分析一下亚马逊上办公椅的畅销品特征"

Agent 将使用:
1. get_bestseller_analysis (category: office_chair, include_reviews: true)
2. compare_marketplace_prices (product_keywords: ergonomic office chair)
```

### 场景 3: 价格调研
```
用户: "现代风格沙发在美国市场的价格范围是多少？"

Agent 将使用:
1. search_furniture_price (product_name: modern sofa, platform: all)
```

### 场景 4: 趋势洞察
```
用户: "帮我了解一下家具行业最新的市场趋势"

Agent 将使用:
1. search_market_trends (topic: furniture market trends, include_reports: true)
2. get_trending_furniture (category: all, timeframe: month)
```

---

## 技术实现

### 网页爬虫
使用 Puppeteer 进行网页爬取，支持：
- Amazon 搜索结果和畅销榜
- Wayfair 产品搜索
- Google Trends 数据
- Pinterest Trends

### 备用数据
当网页爬取失败时，系统会返回基于历史数据的估算值和默认趋势数据，确保工具始终可用。

### 性能优化
- 浏览器实例复用
- 超时处理（30秒）
- 结果缓存和限制
- 错误处理和降级策略

---

## 注意事项

1. **实时性**: 价格和趋势数据基于实时网络搜索，数据可能随时间变化
2. **完整性**: 爬取失败时会使用备用数据，不代表完整市场数据
3. **合规性**: 请遵守各平台的使用条款和爬取政策
4. **准确性**: 价格数据仅供参考，实际价格以平台为准

---

## 未来扩展

计划添加的功能：
- [ ] 更多电商平台支持（eBay, AliExpress, TikTok Shop）
- [ ] 历史价格追踪
- [ ] 批量产品分析
- [ ] 自定义数据源集成
- [ ] 价格提醒功能
