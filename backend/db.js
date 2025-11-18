import dotenv from 'dotenv';
import prisma from './prismaClient.js';

dotenv.config();

export async function initDb() {
    if (!process.env.DATABASE_URL) {
        console.log('No DATABASE_URL provided — running with in-memory sample data only.');
        return;
    }

    await prisma.$connect();

    const count = await prisma.doctor.count();
    if (count === 0) {
        await prisma.doctor.create({ data: { name: 'Dr. Ahuja', email: 'ahuja@example.com' } });
        console.log('Seeded sample doctor Dr. Ahuja');
    }
}

export { prisma };
