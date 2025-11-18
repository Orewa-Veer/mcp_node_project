import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// OAuth2 client configuration
const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID || '',
    process.env.GOOGLE_CLIENT_SECRET || '',
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:4000/auth/google/callback'
);

// Store tokens in a file (in production, use a database)
const TOKENS_FILE = path.join(__dirname, '../../tokens.json');

/**
 * Load stored tokens from file
 */
function loadTokens() {
    try {
        if (fs.existsSync(TOKENS_FILE)) {
            const tokens = JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf8'));
            oauth2Client.setCredentials(tokens);
            return tokens;
        }
    } catch (err) {
        console.warn('Could not load tokens:', err.message);
    }
    return null;
}

/**
 * Save tokens to file
 */
function saveTokens(tokens) {
    try {
        fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2));
    } catch (err) {
        console.warn('Could not save tokens:', err.message);
    }
}

/**
 * Get authorization URL for user to authenticate
 */
export function getAuthUrl() {
    const scopes = ['https://www.googleapis.com/auth/calendar'];
    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
    });
    return authUrl;
}

/**
 * Exchange authorization code for tokens
 */
export async function getTokensFromCode(code) {
    try {
        const { tokens } = await oauth2Client.getToken(code);
        saveTokens(tokens);
        oauth2Client.setCredentials(tokens);
        return { ok: true, tokens };
    } catch (err) {
        console.error('Error getting tokens:', err);
        return { ok: false, error: err.message };
    }
}

/**
 * Check if we have valid tokens
 */
export function hasValidTokens() {
    return loadTokens() !== null;
}

/**
 * Create an event on Google Calendar
 */
export async function createCalendarEvent(eventData) {
    try {
        // Load tokens
        const tokens = loadTokens();
        if (!tokens) {
            // Mock mode: log the event details
            console.log('\n📅 [MOCK] Google Calendar Event Created:');
            console.log('   Summary:', eventData.summary || `Appointment with ${eventData.doctorName}`);
            console.log('   Start:', new Date(eventData.start).toLocaleString());
            console.log('   End:', new Date(eventData.end).toLocaleString());
            console.log('   Attendee:', eventData.patientEmail);
            console.log('   Patient:', eventData.patientName);
            console.log('   Note: To use real Google Calendar, authenticate via GET /auth/google\n');

            return {
                ok: true,
                eventId: `mock_${Date.now()}`,
                eventLink: null,
                mock: true,
                message: 'Calendar event logged (mock mode). Authenticate with /auth/google for real events.',
            };
        }

        oauth2Client.setCredentials(tokens);

        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

        const event = {
            summary: eventData.summary || `Appointment with ${eventData.doctorName}`,
            description: eventData.description || `Patient: ${eventData.patientName}\nEmail: ${eventData.patientEmail}`,
            start: {
                dateTime: new Date(eventData.start).toISOString(),
                timeZone: 'UTC',
            },
            end: {
                dateTime: new Date(eventData.end).toISOString(),
                timeZone: 'UTC',
            },
            attendees: [
                {
                    email: eventData.patientEmail,
                    displayName: eventData.patientName,
                },
            ],
        };

        const result = await calendar.events.insert({
            calendarId: 'primary',
            resource: event,
        });

        return {
            ok: true,
            eventId: result.data.id,
            eventLink: result.data.htmlLink,
        };
    } catch (err) {
        console.error('Error creating calendar event:', err.message);
        return {
            ok: false,
            error: err.message,
            mock: true,
        };
    }
}

/**
 * List events for a date range
 */
export async function listCalendarEvents(dateFrom, dateTo) {
    try {
        const tokens = loadTokens();
        if (!tokens) {
            return {
                ok: false,
                error: 'Not authenticated with Google Calendar.',
                mock: true,
                events: [],
            };
        }

        oauth2Client.setCredentials(tokens);

        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

        const result = await calendar.events.list({
            calendarId: 'primary',
            timeMin: new Date(dateFrom).toISOString(),
            timeMax: new Date(dateTo).toISOString(),
            singleEvents: true,
            orderBy: 'startTime',
        });

        return {
            ok: true,
            events: result.data.items || [],
        };
    } catch (err) {
        console.error('Error listing calendar events:', err);
        return {
            ok: false,
            error: err.message,
            mock: true,
            events: [],
        };
    }
}
