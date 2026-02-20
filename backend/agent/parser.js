export function parser(rawText) {
    try {
        // Strip Markdown code blocks (```json ... ```) if present
        const jsonString = rawText.replace(/^```json\s*/, '').replace(/\s*```$/, '');

        // Find the first { and last } to ignore potential conversational fluff outside JSON
        const match = jsonString.match(/\{[\s\S]*\}/);
        const cleanJson = match ? match[0] : jsonString;

        const plan = JSON.parse(cleanJson);
        if (!plan || !Array.isArray(plan.actions)) {
            return { ok: false, error: 'LLM plan missing "actions" array', plan };
        }
        return { ok: true, plan }
    } catch (err) {
        console.error("[Agent] JSON Parse Failed:", rawText);
        return { ok: false, error: 'Failed to parse LLM JSON output', rawText };
    }



}