// 必须先加载 .env + .env.local（ts-node 不会自动读 .env.local）
import "./scripts/load-env";

// langchain loader 是RAG的基础功能 txt,pdf,excel,excel
import { PuppeteerWebBaseLoader } from "@langchain/community/document_loaders/web/puppeteer";
//PuppeteerWebBaseLoader 是什么？
// 它是 LangChain Loader 家族中的一员，专门用于爬取网页内容的加载器。
// chroma 去做 向量化的知识库数据
console.log("开始向量化知识库数据");
import {
  RecursiveCharacterTextSplitter
} from "langchain/text_splitter";
import { addDocuments, generateDocId } from "./lib/supabase-kb";

console.log(
  "env:",
  process.env.CHROMA_PERSIST_DIR?.trim() ? "CHROMA_PERSIST_DIR=ok" : "CHROMA_PERSIST_DIR=missing (using default: ./chroma_data)",
  process.env.OPENAI_API_KEY?.trim() || process.env.EMBEDDING_API_KEY?.trim()
    ? "OPENAI/EMBEDDING_KEY=ok"
    : "OPENAI/EMBEDDING_KEY=missing（灌库需要；仅 DEEPSEEK 不够）",
  process.env.OPENAI_API_BASE_URL || "(default openai)",
  process.env.AI_DISABLE_PROXY === "1" || process.env.AI_DISABLE_PROXY === "true"
    ? "AI_DISABLE_PROXY=on"
    : process.env.OPENAI_PROXY_URL
      ? "proxy=OPENAI_PROXY_URL"
      : process.env.AI_DISABLE_PROXY === "true"
        ? "AI_DISABLE_PROXY=off"
        : "proxy=off"
);

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 512,  // 切割的长度 512 个字符 包含一个比较独立的语义
  chunkOverlap: 100, // 切割的 overlap 100 个字符 一句话切断容错 
})


const scrapePage = async (url: string): Promise<string> => {
    const loader = new PuppeteerWebBaseLoader(url, {
      launchOptions: {
        executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        headless: true,
      },
      gotoOptions: {
        waitUntil: 'networkidle0',
      },
      evaluate: async(page, browser) => {
        const result = await page.evaluate(() => document.body.innerHTML);
        await browser.close();
        return result;
      }
    });
    // gm 正则修饰符
    return (await loader.scrape()).replace(/<[^>]*>?/gm, '');
  }

const loadData = async (webpages: string[]) => {
    for (const url of webpages) {
        const content = await scrapePage(url);
        // 分块处理
        const chunks = await splitter.splitText(content)
        // console.log(chunks,'-----');
        // embedding 向量化 （对每一个块chunk进行先量化）
        
        // Prepare documents for Chroma
        const documents = chunks.map((chunk, index) => ({
          id: generateDocId(url, index),
          content: chunk,
          metadata: {
            url: url,
            index: index,
            createdAt: new Date().toISOString()
          }
        }));
        
        // Add documents to Chroma
        console.log(`Adding ${documents.length} chunks from ${url} to Chroma...`);
        await addDocuments(documents);
        console.log(`Successfully added ${documents.length} chunks from ${url}`);
    }
}
// 知识库的来源，可配置
loadData([
    "http://localhost:3009/",
    "http://localhost:3009/category/end-&-side-tables-17?categoryId=17&level=2&parentId=1&parentName=End+%26+Side+Tables",
    "http://localhost:3009/category/office-furniture-77?categoryId=77&level=1&categoryName=Office+Furniture",
    // "https://en.wikipedia.org/wiki/Samsung_Galaxy_S24",
    // "https://en.wikipedia.org/wiki/IPhone_16",
    // "https://en.wikipedia.org/wiki/IPhone_16_Pro",
    // "https://en.wikipedia.org/wiki/IPhone_15",
    // "https://en.wikipedia.org/wiki/IPhone_15_Pro",
  ]);
