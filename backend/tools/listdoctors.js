// tools/listDoctors.js
import prisma from '../prismaClient.js';

export const listDoctorsTool = {
    description: 'Returns a list of all doctors in the system',
    async run({ input }) {
        if (!process.env.DATABASE_URL) {
            // Mock response if DB not set (for local dev)
            return {
                ok: true,
                doctors: [
                    { id: 1, name: 'Dr. Ahuja', email: 'ahuja@example.com' },
                    { id: 2, name: 'Dr. Kapoor', email: 'kapoor@example.com' },
                ],
            };
        }

        // Fetch real doctors from database
        const doctors = await prisma.doctor.findMany({
            select: { id: true, name: true, email: true },
        });

        return { ok: true, doctors };
    },
};
