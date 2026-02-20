import { executor } from './executor.js';
import { SYSTEM_INSTRUCTIONS } from './insturctions.js';
import { callLLM } from '../integrations/llm.js';
import { parser } from './parser.js';
import { generateSummary } from './summarizer.js';



const messages = [{ role: "system", content: SYSTEM_INSTRUCTIONS }];

export async function runAgent({ prompt, sessionId }) {
    // Combine System and User prompt
    const body = `${SYSTEM_INSTRUCTIONS}\n\nCurrent User Request: "${prompt}"`;
    messages.push({
        role: "user", content: prompt
    });

    const newMsg = messages.map((m) => {
        if (m.role === "tool") {
            return `[tool:${m.name}] ${m.content}`;
        }
        return `[${m.role}] ${m.content}`;
    }).join("\n");

    console.log(`[Agent] Processing request: "${prompt}"`);

    const llmRes = await callLLM(newMsg, {
        max_tokens: 800,
    });

    // 1. Check for Critical Failures
    if (!llmRes) {
        return { ok: false, error: 'LLM call returned null' };
    }

    if (llmRes.mock) {
        throw new Error('LLM is returning mock responses. Check GEMINI_API_KEY in .env');
    }

    if (!llmRes.ok) {
        return { ok: false, error: 'LLM not configured or call failed', raw: llmRes };
    }

    // 2. Extract Text
    const rawText = llmRes.text || '';

    // 3. Parse JSON safely

    const parsed = parser(rawText);
    if (!parsed.ok) {
        return parsed;
    }
    const plan = parsed.plan;

    // 5. Execute Tools
    const results = await executor(plan, sessionId, messages);

    // 6. Generate Summary
    const summary = await generateSummary(prompt, results);

    return { ok: true, actions: results, summary };
}

