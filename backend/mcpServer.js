import { availabilityTool } from './tools/availability.js';
import { scheduleTool } from './tools/schedule.js';
import { reportTool } from './tools/report.js';
import { listDoctorsTool } from './tools/listdoctors.js';

const tools = {
    availability: availabilityTool,
    schedule: scheduleTool,
    report: reportTool,
    listDoctors: listDoctorsTool
};

export function listTools() {
    return Object.keys(tools).map(name => ({ name, description: tools[name].description }));
}

export async function invokeTool(name, input, sessionId = null) {
    const tool = tools[name];
    if (!tool) throw new Error(`Unknown tool: ${name}`);
    return await tool.run({ input, sessionId });
}
