/**
 * ts-node 跑 seed 等脚本时默认不会加载 .env.local（只有 Next 会自动加载）。
 * 在其它 import 之前执行：先 .env，再 .env.local 覆盖。
 */
import { config } from "dotenv";
import { resolve } from "path";

const root = process.cwd();
config({ path: resolve(root, ".env") });
config({ path: resolve(root, ".env.local"), override: true });
