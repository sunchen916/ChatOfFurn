// 必须先加载 .env + .env.local（ts-node 不会自动读 .env.local）
import "./scripts/load-env";

import { PuppeteerWebBaseLoader } from "@langchain/community/document_loaders/web/puppeteer";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { addDocuments, generateDocId, getCurrentProviderInfo, initializeVectorStore } from "./lib/vector-store";

console.log("==========================================");
console.log("开始向量化知识库数据");
console.log("==========================================");

// 显示当前配置
const providerInfo = getCurrentProviderInfo();
console.log(`\n[配置] 当前向量数据库: ${providerInfo.name} (${providerInfo.type})`);
console.log("[环境]");
console.log("  - EMBEDDING_API_KEY:", process.env.EMBEDDING_API_KEY?.trim() ? "已配置 ✓" : "未配置 ✗");
console.log("  - EMBEDDING_MODEL:", process.env.EMBEDDING_MODEL?.trim() || "(默认)");
console.log("  - CHROMA_PERSIST_DIR:", process.env.CHROMA_PERSIST_DIR?.trim() || "./chroma_data");
console.log("  - SUPABASE_URL:", process.env.SUPABASE_URL?.trim() ? "已配置 ✓" : "未配置");
console.log("  - DATABASE_URL:", process.env.DATABASE_URL?.trim() ? "已配置 ✓" : "未配置 ✗");
console.log("");

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 512,  // 切割的长度 512 个字符 包含一个比较独立的语义
  chunkOverlap: 100, // 切割的 overlap 100 个字符 一句话切断容错 
});

const scrapePage = async (url: string): Promise<string> => {
  const loader = new PuppeteerWebBaseLoader(url, {
    launchOptions: {
      executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      headless: true,
    },
    gotoOptions: {
      waitUntil: 'networkidle0',
    },
    evaluate: async (page, browser) => {
      const result = await page.evaluate(() => document.body.innerHTML);
      await browser.close();
      return result;
    }
  });
  // gm 正则修饰符
  return (await loader.scrape()).replace(/<[^>]*>?/gm, '');
};

const loadData = async (webpages: string[]) => {
  // 初始化向量存储
  await initializeVectorStore();
  
  for (const url of webpages) {
    console.log(`\n[灌库] 正在处理: ${url}`);
    const content = await scrapePage(url);
    
    // 分块处理
    const chunks = await splitter.splitText(content);
    console.log(`[灌库] 分割为 ${chunks.length} 个块`);
    
    // 准备文档
    const documents = chunks.map((chunk, index) => ({
      id: generateDocId(url, index),
      content: chunk,
      metadata: {
        url: url,
        index: index,
        createdAt: new Date().toISOString()
      }
    }));
    
    // 添加到向量数据库
    console.log(`[灌库] 正在添加 ${documents.length} 个文档到 ${providerInfo.name}...`);
    await addDocuments(documents);
    console.log(`[灌库] ✓ 成功添加 ${documents.length} 个文档`);
  }
  
  console.log("\n==========================================");
  console.log("灌库完成!");
  console.log("==========================================");
};

// 知识库的来源，可配置
loadData([
  "http://localhost:3009/",
  "http://localhost:3009/category/end-&-side-tables-17?categoryId=17&level=2&parentId=1&parentName=End+%26+Side+Tables",
  "http://localhost:3009/category/office-furniture-77?categoryId=77&level=1&categoryName=Office+Furniture",
  // 添加更多 URL...
]);
