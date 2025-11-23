import { callLLM } from './llm.js';
import { invokeTool } from '../mcpServer.js';

// === THE FIX IS HERE ===
// We provide specific examples for ALL tools so the AI doesn't get lazy/biased.
const SYSTEM_INSTRUCTIONS = `
You are an AI assistant for a clinic. You map user instructions to tool calls.

You have access to these tools:
1. 'availability' (args: doctorName, dateFrom, dateTo)
2. 'schedule' (args: doctorName, time, patientName)
3. 'report' (args: doctorId)
4. 'listDoctors' (args: {})

RULES:
- Respond with valid JSON only. 
- Output an object with an "actions" array.
- Do not output markdown code blocks (like \`\`\`json).
- Use 'clarify' when a human-friendly message is needed.

=== EXAMPLES (Follow this pattern) ===

User: "Show me all doctors"
Output: {"actions":[{"tool":"listDoctors","input":{}}]}

User: "Is Dr. Ahuja free tomorrow?"
Output: {"actions":[{"tool":"availability","input":{"doctorName":"Dr. Ahuja"}}]}

User: "Book an appointment with Dr. Sharma for tomorrow at 10am"
Output: {"actions":[{"tool":"schedule","input":{"doctorName":"Dr. Sharma","time":"2025-11-20T10:00:00"}}]}

User: "Generate the daily report for doctor ID 5"
Output: {"actions":[{"tool":"report","input":{"doctorId":5}}]}

User: "Hello"
Output: {"actions":[{"tool":"clarify","input":{"question":"Hello! How can I help you with your appointments today?"}}]}

=== END EXAMPLES ===
`;

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
    let plan = null;
    try {
        // Strip Markdown code blocks (```json ... ```) if present
        const jsonString = rawText.replace(/^```json\s*/, '').replace(/\s*```$/, '');

        // Find the first { and last } to ignore potential conversational fluff outside JSON
        const match = jsonString.match(/\{[\s\S]*\}/);
        const cleanJson = match ? match[0] : jsonString;

        plan = JSON.parse(cleanJson);
    } catch (err) {
        console.error("[Agent] JSON Parse Failed:", rawText);
        return { ok: false, error: 'Failed to parse LLM JSON output', rawText };
    }

    // 4. Validate Plan Structure
    if (!plan || !Array.isArray(plan.actions)) {
        return { ok: false, error: 'LLM plan missing "actions" array', plan };
    }

    // 5. Execute Tools
    const results = [];
    for (const action of plan.actions) {
        if (!action.tool) {
            results.push({ action, ok: false, error: 'Action missing tool name' });
            continue;
        }

        // Handle Clarification explicitly
        if (action.tool === 'clarify') {
            results.push({
                action,
                ok: true,
                result: { message: action.input?.question || 'Could you please clarify?' }
            });

            continue;
        }

        // Invoke Real Tools
        try {
            console.log(`[Agent] Invoking tool: ${action.tool}`);
            const r = await invokeTool(action.tool, action.input || {}, sessionId || null);
            messages.push({ role: `tool`, name: action.tool, content: JSON.stringify(r) });
            results.push({ action, ok: true, result: r });
        } catch (err) {
            console.error(`[Agent] Tool ${action.tool} failed:`, err);
            results.push({ action, ok: false, error: String(err) });
        }
    }

    // 6. Generate Summary
    const summary = await generateSummary(prompt, results);

    return { ok: true, actions: results, summary };
}

async function generateSummary(userPrompt, results) {
    // Format tool outputs for the LLM to read
    const resultsContext = results.map(r => {
        if (!r.ok) return `Tool '${r.action?.tool}' Failed: ${r.error}`;

        const tool = r.action?.tool;
        const res = r.result;

        // Simplify complex objects for the summary prompt to save tokens
        if (tool === 'availability') {
            const count = res.slots ? res.slots.length : 0;
            return `Availability Check: Found ${count} slots.`;
        }
        if (tool === 'report') {
            return `Report Generated: (Success)`;
        }

        // Default catch-all
        return `Tool '${tool}' Output: ${JSON.stringify(res).substring(0, 200)}...`;
    }).join('\n');

    const summaryPrompt = `
    You are a helpful assistant.
    User asked: "${userPrompt}"
    
    Tool Results:
    ${resultsContext}
    
    Task: Write a 1-sentence friendly confirmation to the user based on the results. 
    If a tool failed, mention it politely.
    `;

    const llmRes = await callLLM(summaryPrompt, { max_tokens: 150 });

    // Rely on the normalized .text property
    return llmRes.text || 'Actions completed successfully.';
}