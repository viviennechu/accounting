import Anthropic from '@anthropic-ai/sdk'
import type { OcrResult } from './types'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

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
