import dotenv from 'dotenv';

dotenv.config();

const API_KEY = process.env.GEMINI_API_KEY;
const API_URL = process.env.GEMINI_API_URL;

// Generic LLM adapter. Does NOT store or log secrets. Reads credentials from env vars.
// If not configured, returns a safe mock response so the app still functions locally.
export async function callLLM(prompt, opts = {}) {
    if (!API_KEY || !API_URL) {
        // Return a deterministic mock response for local dev/testing
        return {
            ok: false,
            mock: true,
            text: `MOCK LLM RESPONSE for prompt: ${prompt}`,
            data: { text: JSON.stringify({ actions: [{ tool: 'availability', input: { doctorName: 'Dr. Ahuja', dateFrom: new Date().toISOString(), dateTo: new Date(Date.now() + 86400000).toISOString() } }] }) }
        };
    }

    // Example request body — adapt to the Gemini/Vertex API shape you use.
    const body = {
        prompt,
        ...opts
    };

    const res = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_KEY}`
        },
        body: JSON.stringify(body)
    });

    if (!res.ok) {
        const txt = await res.text();
        throw new Error(`LLM request failed: ${res.status} ${txt}`);
    }

    const data = await res.json();
    return { ok: true, data };
}
