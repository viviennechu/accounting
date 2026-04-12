import Anthropic from '@anthropic-ai/sdk'
import type { OcrResult } from './types'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function extractMultipleFromImage(
  imageBase64: string,
  mimeType: string,
  accountList: { code: string; name: string }[]
): Promise<OcrResult[]> {
  const accountListText = accountList
    .map(a => `${a.code} ${a.name}`)
    .join('\n')

  const prompt = `你是台灣的會計系統。這張照片中可能有多張發票、收據或憑證。

請仔細辨識照片中**每一張獨立的**發票/收據/憑證，並逐一提取資料。

對每張憑證提取：
1. date: 日期（格式 YYYY-MM-DD，民國年請轉換為西元年）
2. amount: 金額（阿拉伯數字，不含逗號）
   【找金額的方法，依序嘗試】
   - 找關鍵字旁邊的數字：合計、總計、總金額、小計、實付、應付、NT$、NTD、元整、共計
   - 表格型（估價單/請購單）：找最下方的合計列加總
   - 手寫中文數字請轉換：壹=1 貳=2 參=3 肆=4 伍=5 陸=6 柒=7 捌=8 玖=9 拾=10 佰=100 仟=1000 萬=10000
     例：「壹百伍拾元」= 150、「貳仟元」= 2000
   - 若有多個金額，取最終總金額
   - 真的完全找不到才填 null，不要填 0
3. description: 交易摘要（簡短中文描述，包含商家名稱或用途）
   - 若遇到手寫潦草、模糊或不確定的文字，請用【?】標記，例如：「印章14個-【均?】和銀行收據」
   - 完全無法辨識的字用【?】代替，不要猜測
4. suggested_account_code: 建議科目代號（從下方清單選一個）
5. is_debit: 是否為支出？true=支出/借方，false=收入/貸方
6. confidence: 辨識信心度 "high"/"medium"/"low"
   - high: 印刷字體，清晰可讀
   - medium: 部分手寫或稍模糊，主要資訊可辨識
   - low: 大量手寫或嚴重模糊，需人工確認
7. bbox: 該憑證在照片中的位置（正規化座標 0.0～1.0）
   格式：{"x1": 左邊界, "y1": 上邊界, "x2": 右邊界, "y2": 下邊界}
   - (0,0) 是圖片左上角，(1,1) 是右下角
   - 請精確框住整張憑證，稍微留一點邊距

可用科目清單：
${accountListText}

請以 JSON 陣列格式回傳，每個元素對應一張憑證。若某欄位無法辨識填 null。
只回傳 JSON 陣列，不要其他文字。`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
              data: imageBase64,
            },
          },
          { type: 'text', text: prompt },
        ],
      },
    ],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : '[]'

  try {
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = JSON.parse(cleaned)
    if (!Array.isArray(parsed)) return []
    return parsed.map(item => ({
      date: item.date || null,
      amount: item.amount ? Number(item.amount) : null,
      description: item.description || null,
      suggested_account_code: item.suggested_account_code || null,
      is_debit: item.is_debit ?? true,
      confidence: item.confidence || 'low',
      bbox: item.bbox || null,
    }))
  } catch {
    return []
  }
}

export async function extractFromImage(
  imageBase64: string,
  mimeType: string,
  accountList: { code: string; name: string }[]
): Promise<OcrResult> {
  const accountListText = accountList
    .map(a => `${a.code} ${a.name}`)
    .join('\n')

  const prompt = `你是一個台灣的會計系統，請分析這張圖片（可能是發票、收據、銀行轉帳截圖或其他憑證）。

請提取以下資訊並以 JSON 格式回覆：
1. date: 日期（格式 YYYY-MM-DD，若為民國年請轉換為西元年）
2. amount: 金額（數字，不含逗號）
3. description: 交易摘要（簡短描述，中文）
4. suggested_account_code: 建議的科目代號（從下方清單選擇最接近的一個）
5. is_debit: 是否為借方（支出）？true=支出/借方，false=收入/貸方
6. confidence: 辨識信心度 "high"/"medium"/"low"

可用科目清單：
${accountListText}

只回傳 JSON，不要其他文字。若某欄位無法辨識請填 null。

範例回傳格式：
{"date":"2026-01-15","amount":34233,"description":"電費7106+6903+9443+10778","suggested_account_code":"6130","is_debit":true,"confidence":"high"}`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
              data: imageBase64,
            },
          },
          {
            type: 'text',
            text: prompt,
          },
        ],
      },
    ],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''

  try {
    // 清除可能的 markdown code block
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = JSON.parse(cleaned)
    return {
      date: parsed.date || null,
      amount: parsed.amount ? Number(parsed.amount) : null,
      description: parsed.description || null,
      suggested_account_code: parsed.suggested_account_code || null,
      is_debit: parsed.is_debit ?? true,
      confidence: parsed.confidence || 'low',
    }
  } catch {
    return {
      date: null,
      amount: null,
      description: null,
      suggested_account_code: null,
      is_debit: true,
      confidence: 'low',
    }
  }
}
