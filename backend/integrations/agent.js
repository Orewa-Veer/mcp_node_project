import { callLLM } from './llm.js';
import { invokeTool } from '../mcpServer.js';

// Simple agent connector.
// Given a natural language `prompt` and optional `sessionId`, call the LLM to produce
// a small plan in JSON with an ordered list of tool invocations, then execute them
// using the MCP invoker `invokeTool` and return combined results.

const SYSTEM_INSTRUCTIONS = `You are an agent that maps user instructions to calls to available MCP tools.
Respond with JSON only. Output an object with an "actions" array. Each action must have:
 - tool: the tool name (availability|schedule|report)
 - input: an object with fields for that tool

Example:
{"actions":[{"tool":"availability","input":{"doctorName":"Dr. Ahuja","dateFrom":"2025-11-19T00:00:00Z","dateTo":"2025-11-19T23:59:59Z"}}]}

If uncertain, prefer to ask a clarifying question by returning a single action: {"tool":"clarify","input":{"question":"..."}}
`;

export async function runAgent({ prompt, sessionId }) {
    // Build LLM prompt
    const body = `${SYSTEM_INSTRUCTIONS}\nUser: ${prompt}`;

    const llmRes = await callLLM(body, { max_tokens: 800 });

    if (!llmRes) {
        return { ok: false, error: 'LLM call returned null' };
    }

    // Allow mock responses (ok:false with data) to proceed; only fail if no data at all
    if (!llmRes.ok && !llmRes.data) {
        return { ok: false, error: 'LLM not configured or call failed', raw: llmRes };
    }

    // The adapter returns `data` which may contain different shapes depending on provider.
    // We expect the provider to return JSON in `data.text` or similar. Attempt to extract JSON.
    let text = '';
    if (llmRes.data) {
        // try common shapes
        if (typeof llmRes.data.text === 'string') text = llmRes.data.text;
        else if (typeof llmRes.data.output === 'string') text = llmRes.data.output;
        else text = JSON.stringify(llmRes.data);
    } else if (llmRes.text) {
        text = llmRes.text;
    }

    // Try to parse JSON from the model output
    let plan = null;
    try {
        // models sometimes wrap JSON in backticks or markdown; try to find first JSON object
        const m = text.match(/\{[\s\S]*\}/);
        const jsonText = m ? m[0] : text;
        plan = JSON.parse(jsonText);
    } catch (err) {
        return { ok: false, error: 'Failed to parse LLM JSON output', rawText: text };
    }

    if (!plan || !Array.isArray(plan.actions)) return { ok: false, error: 'LLM plan missing actions array', plan };

    const results = [];
    for (const action of plan.actions) {
        if (!action.tool) {
            results.push({ action, ok: false, error: 'Action missing tool name' });
            continue;
        }

        // Allow a 'clarify' tool that returns text only
        if (action.tool === 'clarify') {
            results.push({ action, ok: true, result: { message: action.input?.question || 'Please clarify' } });
            continue;
        }

        try {
            const r = await invokeTool(action.tool, action.input || {}, sessionId || null);
            results.push({ action, ok: true, result: r });
        } catch (err) {
            results.push({ action, ok: false, error: String(err) });
        }
    }

    // Generate a human-readable summary from the results using the LLM
    const summary = await generateSummary(prompt, results);

    return { ok: true, actions: results, summary };
}

async function generateSummary(userPrompt, results) {
    // Build a summary prompt that asks the LLM to explain the results in plain English
    const resultsText = results.map(r => {
        if (!r.ok) return `Action ${r.action?.tool}: failed with error: ${r.error}`;
        const toolName = r.action?.tool;
        const result = r.result;
        if (toolName === 'availability' && result) {
            const slots = result.slots || [];
            return `Availability check: Found ${slots.length} available slots.`;
        }
        if (toolName === 'schedule' && result) {
            return `Scheduled appointment successfully.`;
        }
        if (toolName === 'report' && result) {
            return `Report: ${JSON.stringify(result.data)}`;
        }
        return `Action ${toolName}: ${JSON.stringify(result)}`;
    }).join('\n');

    const summaryPrompt = `User asked: "${userPrompt}"\n\nAgent actions and results:\n${resultsText}\n\nIn 1-2 sentences, summarize the result for the user in friendly English. Be conversational and helpful.`;

    const llmRes = await callLLM(summaryPrompt, { max_tokens: 200 });

    // Extract text from LLM response
    let summaryText = '';
    if (llmRes && llmRes.data && typeof llmRes.data.text === 'string') {
        summaryText = llmRes.data.text;
    } else if (llmRes && typeof llmRes.text === 'string') {
        summaryText = llmRes.text;
    } else {
        // Fallback to basic summary if LLM fails
        summaryText = resultsText || 'Action completed.';
    }

    return summaryText;
}
