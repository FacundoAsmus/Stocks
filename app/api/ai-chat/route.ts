import { NextRequest, NextResponse } from "next/server";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-3.5-flash";
const GEMINI_FALLBACK_MODEL = "gemini-3.1-flash-lite";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const GEMINI_FALLBACK_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_FALLBACK_MODEL}:generateContent`;

export async function POST(req: NextRequest) {
  if (!GEMINI_API_KEY) {
    return NextResponse.json({ error: "AI not configured — add GEMINI_API_KEY to environment variables" }, { status: 503 });
  }

  const body = await req.json() as {
    messages: { role: "user" | "model"; text: string }[];
    stockContext: string;
  };

  const { messages, stockContext } = body;
  if (!messages?.length) {
    return NextResponse.json({ error: "No messages" }, { status: 400 });
  }

  const systemInstruction = `You are a professional financial analyst assistant embedded in a stock analysis app.
Here is the real-time data you know about this stock:

${stockContext}

Guidelines:
- Be concise, factual, and professional. No personal financial advice.
- When users ask for comparisons between a company and its peers, prioritize comparative analysis over financial education. Always provide the companys metric, the peer average or range, the percentage difference, and a clear conclusion about whether the company trades at a premium or discount. Do not replace missing comparison data with generic explanations of the metric. Introduce additional financial metrics only if they directly support the comparison. Lead with the conclusion, support it with quantitative evidence, and keep explanations concise.
- Use dollar amounts, percentages, and specific figures when available.
- Keep responses under 120 words. Be direct: lead with the conclusion, then the key supporting figure. Cut every word that doesn't add information.
- Do not provide specific buy or sell recommendations. If a metric relates to valuation (like whether a stock is overvalued or undervalued), explain the concept generally and objectively without telling the user what action to take.
- FORMATTING RULE: Whenever you mention a number that represents a positive financial value or gain (e.g. +5.2%, +$12.40, up 3%), wrap it in [[+]]...[[/+]]. Whenever you mention a negative value or loss (e.g. -3.1%, -$8.00, down 2%), wrap it in [[-]]...[[/-]]. Examples: "The stock is up [[+]]+4.2%[[/+]] today." / "Revenue fell [[-]]-8%[[/-]] year-over-year." Only wrap the number and its sign/symbol, not the surrounding sentence.
- VISUALS: You can drop a small visual widget directly into your reply when it genuinely helps the user, using these tags on their own (not inside a sentence):
  • [[data:KEY]] — a compact data pill. KEY must be exactly one of: marketCap, peRatio, forwardPe, eps, dividendYield, beta, high52, low52, avgVolume, priceTarget.
  • [[news:N]] — a clickable news article card (N is the article index 0-7 from the provided news list). Use when discussing specific news that's relevant to the user's question.
  • [[graph:TYPE]] — a small chart. TYPE must be exactly one of:
      price:1D (today), price:1W (1 week), price:1M (1 month), price:3M (3 months), price:5M (5 months), price:6M (6 months), price:1Y (1 year), price:2Y (2 years), price:5Y (5 years), price:ALL (all-time),
      analyst (analyst buy/hold/sell breakdown), sentiment (this app's computed sentiment score), targets (analyst price target range vs. current price).
  Rules: use at most one [[data:...]] tag and at most one [[graph:...]] tag per reply — never repeat the same one twice. Only include a tag when it's the clearest way to answer, not as decoration. Place the tag on its own line so it renders as a standalone visual. ANTI-REDUNDANCY: when you place a widget tag, do NOT repeat the same number or value in the surrounding text — the widget shows it visually, so mentioning the same figure again is redundant. For example, if you place [[data:peRatio]], do not also write "the P/E ratio is 24x" — instead say something like "which puts it at a premium relative to peers." Example good usage: "Here's how the current price compares to where analysts expect it to go:\n[[graph:targets]]\nMost analysts see room to run from here." Do not use these tags for casual conversation — only when discussing this stock's data.
- If asked something unrelated to finance or this stock, politely redirect.
- Speak as if you simply know this data yourself — never say things like "the information you provided," "based on what you shared," or "according to the data given to me." Just state facts directly, e.g. "The stock is currently trading at $X" instead of "The data you provided shows the stock trading at $X."
- Provide your answer as simple text paragraphs. Avoid markdown headers (###) or bold markdown (**), but write out complete sentences.
`;

  const contents = [
    { role: "user", parts: [{ text: systemInstruction }] },
    { role: "model", parts: [{ text: "Understood. I'm ready to analyze this stock data professionally." }] },
    ...messages.map(m => ({
      role: m.role,
      parts: [{ text: m.text }],
    })),
  ];

  const requestBody = JSON.stringify({
    contents,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 512,
    },
  });

  async function callGemini(url: string) {
    return fetch(`${url}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: requestBody,
      signal: AbortSignal.timeout(30000),
    });
  }

  try {
    let res = await callGemini(GEMINI_URL);

    // Retry with fallback model if primary is unavailable or rate-limited
    if (res.status === 404 || res.status === 429) {
      res = await callGemini(GEMINI_FALLBACK_URL);
    }

    if (!res.ok) {
      const err = await res.text();
      console.error("Gemini error:", err);
      return NextResponse.json({ error: `Gemini error: ${res.status} — ${err.slice(0, 200)}` }, { status: 502 });
    }

    const data = await res.json() as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    return NextResponse.json({ text });
  } catch (e) {
    console.error("AI chat error:", e);
    return NextResponse.json({ error: "Request failed" }, { status: 500 });
  }
}
