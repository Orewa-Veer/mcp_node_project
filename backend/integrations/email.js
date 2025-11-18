export async function sendEmail({ to, subject, body }) {
    // Mock implementation. Replace with real provider (SendGrid, Gmail API, etc.)
    console.log('sendEmail', { to, subject, body });
    return { ok: true };
}
