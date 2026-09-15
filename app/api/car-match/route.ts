import { generateText } from 'ai';
import { getChatProvider, getDefaultChatModelId } from '@/lib/openai';

const chat = getChatProvider();

/** 与前端 `app/car-match/page.tsx` 字段一致：12 项策略画像 + 8 项经营参数 */
export interface QuizAnswers {
  adventure: number;
  spending: number;
  family: number;
  techLove: number;
  statusCare: number;
  environmentCare: number;
  drivingFun: number;
  safety: number;
  practicality: number;
  style: number;
  independence: number;
  brandLoyalty: number;
  commuteDistance: number;
  annualMileage: number;
  passengerFreq: number;
  parkingCondition: number;
  budget: number;
  fuelPreference: number;
  cargoNeed: number;
  weatherCondition: number;
}

const buildPrompt = (a: QuizAnswers): string => {
  const channel = ['独立站为主', '第三方平台为主', '独立站+平台混合'][
    a.parkingCondition - 1
  ];
  const material = ['木作主线', '金属/软体主线', '板木结合/工程配套'][a.fuelPreference - 1];
  const region = ['北美为主', '欧洲为主', '亚太及其他'][a.weatherCondition - 1];

  return `
你是 ChaTofFun，专注「外贸家具」的选品与产品线顾问。请根据下列**站点策略问卷**（数值均为用户自评或设定），输出 3 条**可落地的「主推产品线 / 爆款方向」**建议，用于团队内部讨论（非合同报价）。

## 策略画像（1=低，5=高）
- 新品类/新市场探索意愿：${a.adventure}/5
- 品质与素材投入意愿：${a.spending}/5
- 团队协同与客户体量感：${a.family}/5
- 数字化（独立站/视觉/3D 等）投入意愿：${a.techLove}/5
- 品牌形象与溢价重视：${a.statusCare}/5
- 可持续与认证（如环保、合规）重视：${a.environmentCare}/5
- 设计创新大胆度：${a.drivingFun}/5
- 合规与质检优先级：${a.safety}/5
- 成本与交付务实度：${a.practicality}/5
- 外观审美权重：${a.style}/5
- 差异化款（非大路货）意愿：${a.independence}/5
- 自有品牌 vs OEM 灵活度（越高越坚持自有品牌）：${a.brandLoyalty}/5

## 经营参数
- 典型打样/上新周期参考（天）：${a.commuteDistance}
- 活跃 SKU 量级参考（个数）：${a.annualMileage}
- 售后与客户服务深度：${a.passengerFreq}/5
- 销售渠道侧重：${channel}
- 单批次打样/开款预算（万元人民币）：${a.budget}
- 材质工艺主线：${material}
- 定制/ODM 订单占比诉求：${a.cargoNeed}/5
- 目标市场侧重：${region}

## 输出要求
请**只输出**一个 JSON 对象，不要 markdown、不要前后说明文字。字段名必须完全一致：

{
  "summary": "一句话概括当前站点选品策略重心（30字以内）",
  "top3": [
    {
      "rank": 1,
      "name": "产品线或爆款方向名称（可含场景，如「北欧板式客厅组合」）",
      "price": "建议 FOB 或价位带文字（如「中端 FOB 80–120 美金/件」）",
      "type": "主场景品类（客厅/餐厅/卧房/办公民宿等）",
      "fuel": "核心材质与工艺组合（如「橡木贴皮+钢架」）",
      "totalScore": 92,
      "reason": "与上述画像的契合理由（60字以内）",
      "highlight": "亮点标签（8字以内）",
      "dimensions": {
        "市场契合": 88,
        "设计差异": 85,
        "供应链": 80,
        "物流包装": 78,
        "利润周转": 82,
        "品牌内容": 86
      }
    },
    {
      "rank": 2,
      "name": "...",
      "price": "...",
      "type": "...",
      "fuel": "...",
      "totalScore": 88,
      "reason": "...",
      "highlight": "...",
      "dimensions": {
        "市场契合": 80,
        "设计差异": 88,
        "供应链": 86,
        "物流包装": 80,
        "利润周转": 84,
        "品牌内容": 80
      }
    },
    {
      "rank": 3,
      "name": "...",
      "price": "...",
      "type": "...",
      "fuel": "...",
      "totalScore": 84,
      "reason": "...",
      "highlight": "...",
      "dimensions": {
        "市场契合": 78,
        "设计差异": 80,
        "供应链": 88,
        "物流包装": 85,
        "利润周转": 80,
        "品牌内容": 78
      }
    }
  ]
}

注意：
1. totalScore 为 0–100 的匹配度；dimensions 六个键名必须逐字为「市场契合」「设计差异」「供应链」「物流包装」「利润周转」「品牌内容」，值为 0–100。
2. 不要求真实 SKU；给出**方向性**产品线即可，避免杜撰具体海关编码。
3. name/price 表述需与用户的渠道、市场、预算、材质主线**自洽**。
`;
};

export async function POST(req: Request) {
  try {
    const { answers }: { answers: QuizAnswers } = await req.json();

    const prompt = buildPrompt(answers);

    const { text } = await generateText({
      model: chat(getDefaultChatModelId()),
      messages: [
        {
          role: 'system',
          content:
            '你是 ChaTofFun 外贸家具选品顾问。只输出 JSON，不要输出任何其他文字、解释或 markdown。',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.65,
      maxTokens: 2200,
    });

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Invalid AI response format');
    }

    const result = JSON.parse(jsonMatch[0]);
    return Response.json({ success: true, data: result });
  } catch (err) {
    console.error('car-match error:', err);
    return Response.json(
      { success: false, error: 'Failed to generate recommendation' },
      { status: 500 }
    );
  }
}
