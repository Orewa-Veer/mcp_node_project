export async function generateSummary(userPrompt, results) {
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