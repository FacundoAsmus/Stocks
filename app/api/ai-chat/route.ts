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
- Keep responses under 200 words unless a detailed breakdown is explicitly requested.
- Do not provide specific buy or sell recommendations. If a metric relates to valuation (like whether a stock is overvalued or undervalued), explain the concept generally and objectively without telling the user what action to take.
- FORMATTING RULE: Whenever you mention a number that represents a positive financial value or gain (e.g. +5.2%, +$12.40, up 3%), wrap it in [[+]]...[[/+]]. Whenever you mention a negative value or loss (e.g. -3.1%, -$8.00, down 2%), wrap it in [[-]]...[[/-]]. Examples: "The stock is up [[+]]+4.2%[[/+]] today." / "Revenue fell [[-]]-8%[[/-]] year-over-year." Only wrap the number and its sign/symbol, not the surrounding sentence.
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
  return NextResponse.json(
    { 
      error: "Request failed", 
      details: e instanceof Error ? e.message : String(e) 
    }, 
    { status: 500 }
  );
}
}
