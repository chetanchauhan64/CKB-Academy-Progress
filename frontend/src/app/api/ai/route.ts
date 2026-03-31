import { NextResponse } from 'next/server';

type AIActionType = 'improve' | 'title' | 'summary';

interface AIRequest {
  type: AIActionType;
  content: string;
}

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a professional Web3 technical writer.

Write content that is:
- Clear and beginner-friendly
- Structured and engaging
- SEO optimized
- Concise but informative

Focus on:
- Blockchain clarity
- Strong headlines
- Clean explanations`;

// ─── Per-action user prompts ──────────────────────────────────────────────────

const PROMPTS: Record<AIActionType, (content: string) => string> = {
  improve: (content) =>
    `Rewrite the following blog post content to be more engaging, clear, and well-structured. Preserve the author's voice and all technical accuracy. Keep the Markdown formatting. Return ONLY the improved content, no preamble.

---
${content.slice(0, 8000)}
---`,

  title: (content) =>
    `Based on the blog post content below, generate exactly 3 compelling, concise blog title options. Each title should be on its own line, numbered (1. 2. 3.). Return ONLY the numbered list, nothing else.

---
${content.slice(0, 4000)}
---`,

  summary: (content) =>
    `Write a one-sentence summary (maximum 160 characters) for the following blog post. This summary will appear on the feed as a post description. Return ONLY the summary sentence, no preamble or quotes.

---
${content.slice(0, 4000)}
---`,
};

// ─── Mock responses (used when no API key is set) ─────────────────────────────

const MOCK_RESPONSES: Record<AIActionType, string> = {
  improve: `## Introduction\n\nThis post explores key ideas in the decentralized web, written for the ChainPress platform on Nervos CKB.\n\n## Key Points\n\n- Blockchain-native content is permanent and immutable\n- CKBFS witnesses store your data securely on-chain\n- Adler32 checksums guarantee content integrity\n\n## Conclusion\n\nDecentralized publishing changes how we think about content ownership forever.\n\n> *Add your OPENROUTER_API_KEY to .env.local for real AI-powered improvements.*`,
  title:
    "1. Building on CKB: A Developer's Guide to Decentralized Publishing\n2. Why On-Chain Blogging is the Future of Content Ownership\n3. ChainPress: Permanent, Censorship-Resistant Blogs on Nervos CKB",
  summary:
    'A deep dive into decentralized publishing on Nervos CKB using CKBFS — immutable, censorship-resistant, and wallet-native.',
};

// ─── OpenRouter call helper ───────────────────────────────────────────────────

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODELS = ['anthropic/claude-3-haiku', 'mistralai/mixtral-8x7b'] as const;

async function callOpenRouter(
  apiKey: string,
  type: AIActionType,
  content: string
): Promise<string> {
  const prompt = PROMPTS[type](content);
  let lastError: unknown;

  for (const model of MODELS) {
    try {
      const response = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'ChainPress AI',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: prompt },
          ],
          temperature: 0.7,
          max_tokens: type === 'improve' ? 2048 : 256,
        }),
      });

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`OpenRouter API error ${response.status}: ${errBody.slice(0, 200)}`);
      }

      const data = await response.json() as {
        choices?: Array<{ message: { content: string } }>;
      };

      const result = data.choices?.[0]?.message?.content?.trim() ?? '';
      if (!result) throw new Error(`Empty response from model ${model}`);

      return result;
    } catch (e) {
      console.warn(`[AI] Model ${model} failed:`, e);
      lastError = e;
    }
  }

  throw lastError ?? new Error('All OpenRouter models failed');
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const body = await req.json() as Partial<AIRequest>;
    const { type, content } = body;

    if (!type || !['improve', 'title', 'summary'].includes(type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid type. Must be: improve | title | summary' },
        { status: 400 }
      );
    }
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Content is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENROUTER_API_KEY;

    // ── No API key → return mock ───────────────────────────────────────────────
    if (!apiKey) {
      await new Promise(r => setTimeout(r, 800));
      return NextResponse.json({ success: true, data: MOCK_RESPONSES[type as AIActionType], mock: true });
    }

    // ── Real OpenRouter call (Claude 3 Haiku → Mixtral fallback) ──────────────
    const result = await callOpenRouter(apiKey, type as AIActionType, content);
    return NextResponse.json({ success: true, data: result, mock: false });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
