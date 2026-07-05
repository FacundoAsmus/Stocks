import { NextRequest, NextResponse } from "next/server";

// API key lives only in the server environment — never sent to the client
// Set GEMINI_API_KEY in your Vercel dashboard or .env.local
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent";

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
You have been provided with the following real-time data for this stock:

${stockContext}

Guidelines:
- Be concise, factual, and professional. No personal financial advice.
- Base answers primarily on the provided stock data.
- Use dollar amounts, percentages, and specific figures when available.
- Keep responses under 200 words unless a detailed breakdown is explicitly requested.
- Never recommend buying or selling — only provide analysis and context.
- If asked something unrelated to finance or this stock, politely redirect.`;

  // Build Gemini contents array
  const contents = [
    { role: "user", parts: [{ text: systemInstruction }] },
    { role: "model", parts: [{ text: "Understood. I'm ready to analyze this stock data professionally." }] },
    ...messages.map(m => ({
      role: m.role,
      parts: [{ text: m.text }],
    })),
  ];

  try {
    const res = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 512,
        },
      }),
      signal: AbortSignal.timeout(30000),
    });

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
