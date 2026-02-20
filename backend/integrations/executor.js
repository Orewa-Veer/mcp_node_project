import { invokeTool } from "../mcpServer";
export async function executor(plan, sessionId, messages) {
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
    return results;
}