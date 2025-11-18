import prisma from '../prismaClient.js';

export const availabilityTool = {
    description: "Check a doctor's available slots for a date range",
    async run({ input }) {
        // input: { doctorName, dateFrom, dateTo }
        // If no DB configured, return mocked slots.
        if (!process.env.DATABASE_URL) {
            return { slots: [{ start: new Date().toISOString(), end: new Date(Date.now() + 30 * 60000).toISOString() }] };
        }

        const doctor = await prisma.doctor.findFirst({ where: { name: input.doctorName } });
        if (!doctor) return { slots: [], doctor: null };

        const from = input.dateFrom ? new Date(input.dateFrom) : new Date();
        const to = input.dateTo ? new Date(input.dateTo) : new Date(from.getTime() + 24 * 3600 * 1000);

        const appts = await prisma.appointment.findMany({
            where: { doctorId: doctor.id, startTs: { gte: from, lte: to } },
            orderBy: { startTs: 'asc' }
        });

        if (appts.length === 0) {
            const base = from;
            return {
                doctor: { id: doctor.id, name: doctor.name },
                slots: [
                    { id: `slot-1`, start: new Date(base.getTime() + 9 * 3600 * 1000).toISOString(), end: new Date(base.getTime() + 9 * 3600 * 1000 + 30 * 60000).toISOString() },
                    { id: `slot-2`, start: new Date(base.getTime() + 10 * 3600 * 1000).toISOString(), end: new Date(base.getTime() + 10 * 3600 * 1000 + 30 * 60000).toISOString() }
                ]
            };
        }

        return { doctor: { id: doctor.id, name: doctor.name }, appointments: appts.map(a => ({ id: `appt-${a.id}`, start: a.startTs.toISOString(), end: a.endTs.toISOString() })) };
    }
};
