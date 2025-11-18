import dotenv from 'dotenv';

dotenv.config();

const SLACK_WEBHOOK = process.env.SLACK_WEBHOOK_URL;

// Send a message to Slack (doctor notifications)
export async function sendSlackNotification({ doctorName, message, data }) {
    if (!SLACK_WEBHOOK) {
        console.log('[SLACK MOCK]', { doctorName, message, data });
        return { ok: true, mock: true };
    }

    const payload = {
        text: `📋 Report for ${doctorName}`,
        blocks: [
            {
                type: 'section',
                text: { type: 'mrkdwn', text: `*${doctorName}*\n${message}` }
            },
            {
                type: 'section',
                text: { type: 'mrkdwn', text: `\`\`\`${JSON.stringify(data, null, 2)}\`\`\`` }
            }
        ]
    };

    try {
        const res = await fetch(SLACK_WEBHOOK, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error(`Slack API returned ${res.status}`);
        return { ok: true, sent: true };
    } catch (err) {
        console.error('Slack notification failed', err);
        return { ok: false, error: String(err) };
    }
}
