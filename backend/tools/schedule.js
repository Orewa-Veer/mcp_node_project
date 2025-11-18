import prisma from '../prismaClient.js';
import { sendEmail } from '../integrations/email.js';
import { createCalendarEvent } from '../integrations/calendar.js';

export const scheduleTool = {
    description: 'Schedule an appointment and (optionally) create a Google Calendar event and send email',
    async run({ input }) {
        // input: { doctorName, patientName, patientEmail, start, end, notes }
        if (!process.env.DATABASE_URL) {
            // mock scheduling
            await sendEmail({ to: input.patientEmail, subject: 'Appointment Confirmed', body: `Your appointment with ${input.doctorName} is confirmed at ${input.start}` });
            return { success: true, message: 'Mock appointment created' };
        }

        let doctorId = input.doctorId || null;
        if (!doctorId) {
            const doctor = await prisma.doctor.findFirst({ where: { name: input.doctorName } });
            if (!doctor) throw new Error('Doctor not found');
            doctorId = doctor.id;
        }

        // Create appointment in database
        const appointment = await prisma.appointment.create({
            data: {
                doctorId,
                patientName: input.patientName,
                patientEmail: input.patientEmail,
                startTs: new Date(input.start),
                endTs: new Date(input.end),
                notes: input.notes || null
            }
        });

        // Try to create Google Calendar event
        const calendarResult = await createCalendarEvent({
            summary: `Appointment with Dr. ${input.doctorName}`,
            description: input.notes || `Patient: ${input.patientName}`,
            patientName: input.patientName,
            patientEmail: input.patientEmail,
            doctorName: input.doctorName,
            start: input.start,
            end: input.end,
        });

        // Send confirmation email
        const emailBody = `Your appointment with ${input.doctorName} is confirmed!

Date & Time: ${new Date(input.start).toLocaleString()}
Patient Name: ${input.patientName}
${calendarResult.ok && calendarResult.eventLink ? `Calendar: ${calendarResult.eventLink}` : ''}

We look forward to seeing you!`;

        await sendEmail({
            to: input.patientEmail,
            subject: 'Appointment Confirmed',
            body: emailBody
        });

        return {
            ok: true,
            success: true,
            appointment,
            calendar: calendarResult.ok ? { eventId: calendarResult.eventId, eventLink: calendarResult.eventLink } : null,
        };
    }
};
