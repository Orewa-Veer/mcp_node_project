import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

import { listTools, invokeTool } from './mcpServer.js';
import { initDb } from './db.js';
import { runAgent } from './integrations/agent.js';
import { sendSlackNotification } from './integrations/slack.js';
import { getAuthUrl, getTokensFromCode, hasValidTokens, createCalendarEvent } from './integrations/calendar.js';
import { createDoctorToken, createPatientToken, authMiddleware, doctorMiddleware, patientMiddleware } from './integrations/auth.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4000;
console.log(`[INFO] Starting server on port ${PORT}`);
console.log(`[INFO] NODE_ENV: ${process.env.NODE_ENV}`);

app.get('/health', (req, res) => res.json({ ok: true }));

app.get('/mcp/tools', async (req, res) => {
    res.json(listTools());
});

app.post('/mcp/invoke', async (req, res) => {
    const { tool, input, sessionId } = req.body;
    try {
        const result = await invokeTool(tool, input || {}, sessionId || null);
        res.json({ ok: true, result });
    } catch (err) {
        console.error('invoke error', err);
        res.status(500).json({ ok: false, error: String(err) });
    }
});

// Agent endpoint: accept a natural language prompt, use LLM to plan tool calls, run them and return results
app.post('/agent/prompt', async (req, res) => {
    const { prompt, sessionId } = req.body;
    if (!prompt) return res.status(400).json({ ok: false, error: 'prompt is required' });
    try {
        const result = await runAgent({ prompt, sessionId });
        res.json(result);
    } catch (err) {
        console.error('agent error', err);
        res.status(500).json({ ok: false, error: String(err) });
    }
});

// Patient session endpoint (create JWT for patient)
app.post('/patient/session', (req, res) => {
    const { patientName, patientEmail } = req.body;
    if (!patientName || !patientEmail) {
        return res.status(400).json({ ok: false, error: 'patientName and patientEmail required' });
    }

    try {
        const token = createPatientToken(null, patientName, patientEmail);
        res.json({ ok: true, token, patient: { name: patientName, email: patientEmail } });
    } catch (err) {
        console.error('session error', err);
        res.status(500).json({ ok: false, error: String(err) });
    }
});

// Google Calendar OAuth endpoints
app.get('/auth/google', (req, res) => {
    const authUrl = getAuthUrl();
    res.json({ ok: true, authUrl });
});

app.get('/auth/google/callback', async (req, res) => {
    const { code, state } = req.query;
    if (!code) return res.status(400).json({ ok: false, error: 'Authorization code missing' });

    const result = await getTokensFromCode(code);
    if (result.ok) {
        res.json({ ok: true, message: 'Google Calendar authenticated successfully!' });
    } else {
        res.status(500).json(result);
    }
});

app.get('/auth/google/status', (req, res) => {
    const authenticated = hasValidTokens();
    res.json({ ok: true, authenticated });
});

// Setup endpoint: directly save tokens for testing (use OAuth flow in production)
app.post('/auth/google/setup', (req, res) => {
    try {
        const tokensDir = path.join(process.cwd(), '..');
        const tokensFile = path.join(tokensDir, 'tokens.json');

        // Create a minimal tokens object
        // This will trigger the "not authenticated" flow in createCalendarEvent
        // unless a real access token is provided
        const minimalTokens = {
            type: 'authorized_user',
            client_id: process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET,
            refresh_token: 'dummy_refresh_token_for_demo',
            expiry_date: Date.now() + 3600000
        };

        fs.writeFileSync(tokensFile, JSON.stringify(minimalTokens, null, 2));

        res.json({
            ok: true,
            message: 'Demo token setup complete. For real Google Calendar access, authenticate with OAuth.',
            authenticated: hasValidTokens()
        });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

// Doctor endpoints
app.post('/doctor/login', async (req, res) => {
    const { doctorName } = req.body;
    if (!doctorName) return res.status(400).json({ ok: false, error: 'doctorName required' });

    try {
        const prisma = (await import('./prismaClient.js')).default;
        const doctor = await prisma.doctor.findFirst({ where: { name: doctorName } });
        if (!doctor) return res.status(404).json({ ok: false, error: 'Doctor not found' });

        // Create JWT token
        const token = createDoctorToken(doctor.id, doctor.name, doctor.email);
        res.json({ ok: true, doctor: { id: doctor.id, name: doctor.name, email: doctor.email }, token });
    } catch (err) {
        console.error('login error', err);
        res.status(500).json({ ok: false, error: String(err) });
    }
});

// Get doctor's appointments and stats (protected)
app.get('/doctor/dashboard/:doctorId', authMiddleware, doctorMiddleware, async (req, res) => {
    const { doctorId } = req.params;
    if (!doctorId) return res.status(400).json({ ok: false, error: 'doctorId required' });

    try {
        const prisma = (await import('./prismaClient.js')).default;

        // Get doctor details
        const doctor = await prisma.doctor.findUnique({ where: { id: parseInt(doctorId) } });
        if (!doctor) return res.status(404).json({ ok: false, error: 'Doctor not found' });

        // Get today's appointments
        const now = new Date();
        const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startTomorrow = new Date(startToday.getTime() + 24 * 3600 * 1000);

        const appointmentsToday = await prisma.appointment.findMany({
            where: { doctorId: parseInt(doctorId), startTs: { gte: startToday, lt: startTomorrow } },
            orderBy: { startTs: 'asc' }
        });

        const appointmentsTomorrow = await prisma.appointment.findMany({
            where: { doctorId: parseInt(doctorId), startTs: { gte: startTomorrow, lt: new Date(startTomorrow.getTime() + 24 * 3600 * 1000) } },
            orderBy: { startTs: 'asc' }
        });

        // Get stats
        const startYesterday = new Date(startToday.getTime() - 24 * 3600 * 1000);
        const visitsYesterday = await prisma.appointment.count({
            where: { doctorId: parseInt(doctorId), startTs: { gte: startYesterday, lt: startToday } }
        });

        res.json({
            ok: true,
            doctor,
            appointmentsToday,
            appointmentsTomorrow,
            visitsYesterday,
            stats: { visitsYesterday, appointmentsToday: appointmentsToday.length, appointmentsTomorrow: appointmentsTomorrow.length }
        });
    } catch (err) {
        console.error('dashboard error', err);
        res.status(500).json({ ok: false, error: String(err) });
    }
});

// Trigger report and send Slack notification (protected)
app.post('/doctor/report', authMiddleware, doctorMiddleware, async (req, res) => {
    const { doctorId } = req.body;
    // Verify the doctor is accessing their own report
    if (parseInt(doctorId) !== req.user.doctorId) {
        return res.status(403).json({ ok: false, error: 'Cannot access other doctors\' reports' });
    }

    try {
        // Get report data
        const prisma = (await import('./prismaClient.js')).default;
        const now = new Date();
        const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startYesterday = new Date(startToday.getTime() - 24 * 3600 * 1000);
        const startTomorrow = new Date(startToday.getTime() + 24 * 3600 * 1000);
        const startDayAfter = new Date(startTomorrow.getTime() + 24 * 3600 * 1000);

        const visitsYesterday = await prisma.appointment.count({
            where: { doctorId: parseInt(doctorId), startTs: { gte: startYesterday, lt: startToday } }
        });

        const appointmentsToday = await prisma.appointment.count({
            where: { doctorId: parseInt(doctorId), startTs: { gte: startToday, lt: startTomorrow } }
        });

        const appointmentsTomorrow = await prisma.appointment.count({
            where: { doctorId: parseInt(doctorId), startTs: { gte: startTomorrow, lt: startDayAfter } }
        });

        const reportData = { visitsYesterday, appointmentsToday, appointmentsTomorrow };
        const message = `Visits yesterday: ${visitsYesterday}\nAppointments today: ${appointmentsToday}\nAppointments tomorrow: ${appointmentsTomorrow}`;

        // Send Slack notification
        const slackRes = await sendSlackNotification({ doctorName, message, data: reportData });

        res.json({ ok: true, report: reportData, notification: slackRes });
    } catch (err) {
        console.error('report error', err);
        res.status(500).json({ ok: false, error: String(err) });
    }
});

// serve frontend static (if present)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use('/frontend', express.static(path.join(__dirname, '..', 'frontend')));

async function start() {
    await initDb();
    app.listen(PORT, () => console.log(`MCP backend running on http://localhost:${PORT}`));
}

start().catch(err => {
    console.error('Failed to start', err);
    process.exit(1);
});
