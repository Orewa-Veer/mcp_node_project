import prisma from '../prismaClient.js';

export const reportTool = {
    description: 'Generate a summary report for a doctor (visits yesterday, appointments today/tomorrow, filters)',
    async run({ input }) {
        // input: { doctorName, dateFrom, dateTo, filters }
        if (!process.env.DATABASE_URL) {
            return { summary: 'No DB configured; returning mock report', data: { visitsYesterday: 5, appointmentsToday: 3 } };
        }

        const doctor = await prisma.doctor.findFirst({ where: { name: input.doctorName } });
        if (!doctor) return { summary: 'Doctor not found' };
        const doctorId = doctor.id;

        const now = new Date();
        const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startYesterday = new Date(startToday.getTime() - 24 * 3600 * 1000);
        const startTomorrow = new Date(startToday.getTime() + 24 * 3600 * 1000);
        const startDayAfter = new Date(startTomorrow.getTime() + 24 * 3600 * 1000);

        const visitsYesterday = await prisma.appointment.count({ where: { doctorId, startTs: { gte: startYesterday, lt: startToday } } });
        const appointmentsToday = await prisma.appointment.count({ where: { doctorId, startTs: { gte: startToday, lt: startTomorrow } } });
        const appointmentsTomorrow = await prisma.appointment.count({ where: { doctorId, startTs: { gte: startTomorrow, lt: startDayAfter } } });

        return { summary: `Doctor ${input.doctorName} report`, data: { visitsYesterday, appointmentsToday, appointmentsTomorrow } };
    }
};
