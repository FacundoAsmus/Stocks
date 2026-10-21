type AIChatResponse = { text?: string; error?: string };

const RETRY_DELAY_MS = 3000;

/** Retry a chat request once after three seconds, reusing the exact same body. */
export async function requestAIChat(body: unknown): Promise<string> {
  const serializedBody = JSON.stringify(body);
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: serializedBody,
      });
      const payload = await response.json().catch(() => ({})) as AIChatResponse;
      if (!response.ok || payload.error || !payload.text) {
        throw new Error(payload.error ?? `AI chat request failed (${response.status}).`);
      }
      return payload.text;
    } catch (error) {
      lastError = error;
      if (attempt === 0) await new Promise((resolve) => window.setTimeout(resolve, RETRY_DELAY_MS));
    }
  }

  throw lastError instanceof Error ? lastError : new Error("AI chat server unavailable.");
}
