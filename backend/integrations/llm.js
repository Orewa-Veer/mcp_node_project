import dotenv from 'dotenv';
dotenv.config();

const API_KEY = process.env.GEMINI_API_KEY;
// This should be: https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent
const API_URL = process.env.GEMINI_API_URL;

console.log('[LLM Init] Key Present:', !!API_KEY);
console.log('[LLM Init] Target URL:', API_URL);

export async function callLLM(prompt, opts = {}) {
    // 1. FAIL FAST: If no key, stop. Don't return fake "availability" data.
    if (!API_KEY || !API_URL) {
        console.error("❌ MISSING CONFIG: Check .env for GEMINI_API_KEY and GEMINI_API_URL");
        throw new Error("Missing LLM Configuration");
    }

    console.log(`[LLM] Sending Prompt (${prompt.length} chars)...`);

    // 2. Construct the Standard Gemini Payload
    const body = {
        contents: [{
            parts: [{ text: prompt }]
        }],
        generationConfig: {
            maxOutputTokens: opts.max_tokens || 800,
            temperature: 0.2 // Low temperature for more deterministic JSON
        }
    };

    try {
        // 3. Make the Request
        // Note: The API Key goes in the Query Parameter (?key=), not the Header, for this endpoint.
        const endpoint = `${API_URL}?key=${API_KEY}`;

        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (!res.ok) {
            const errorText = await res.text();
            console.error(`[LLM] API Error ${res.status}:`, errorText);
            return { ok: false, error: errorText };
        }

        const data = await res.json();

        // 4. Extract Text safely
        // Gemini response structure: candidates[0].content.parts[0].text
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) {
            console.error("[LLM] Empty response from API");
            return { ok: false, error: "Empty response" };
        }

        console.log("[LLM] Success! Response received.");
        return { ok: true, text: text, data: data };

    } catch (err) {
        console.error("[LLM] Network/Logic Error:", err);
        return { ok: false, error: err.message };
    }
}