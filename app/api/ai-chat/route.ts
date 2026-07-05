import { NextRequest, NextResponse } from "next/server";

// API key lives only in the server environment — never sent to the client
// Set GEMINI_API_KEY in your Vercel dashboard or .env.local
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
// "gemini-pro" was retired long ago — it now 404s on every API version.
// gemini-2.5-flash is the current free-tier-eligible model (fast + good quality).
// If it ever gets deprecated too, gemini-2.5-flash-lite is the fallback below.
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

  // System instruction injected as first turn
  const systemInstruction = `You are a professional financial analyst assistant embedded in a stock analysis app.
Here is the real-time data you know about this stock:

${stockContext}

Guidelines:
- Be concise, factual, and professional. No personal financial advice.
- Use dollar amounts, percentages, and specific figures when available.
- Keep responses under 200 words unless a detailed breakdown is explicitly requested.
- Do not provide specific buy or sell recommendations. If a metric relates to valuation (like whether a stock is overvalued or undervalued), explain the concept generally and objectively without telling the user what action to take.
- If asked something unrelated to finance or this stock, politely redirect.
- Speak as if you simply know this data yourself — never say things like "the information you provided," "based on what you shared," or "according to the data given to me." Just state facts directly, e.g. "The stock is currently trading at $X" instead of "The data you provided shows the stock trading at $X."
- Provide your answer as simple text paragraphs. Avoid markdown headers (###) or bold markdown (**), but write out complete sentences.
- When referencing a news article, include its actual link (the URL given above) so the person can tap through to read it, not just the headline.`;

  // Build Gemini contents array
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

    // If the primary model isn't available (e.g. deprecated/renamed again),
    // automatically retry once against the fallback model instead of erroring out.
    if (res.status === 404) {
      res = await callGemini(GEMINI_FALLBACK_URL);
    }

    if (!res.ok) {
      const err = await res.text();
      console.error("Gemini error:", err);
      // Surface the actual error in development
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
