import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    console.log('Seeding database...');
    const doctor = await prisma.doctor.upsert({
        where: { id: 1 },
        update: {},
        create: { name: 'Dr. Ahuja', email: 'ahuja@example.com' }
    });

    // create a sample appointment tomorrow at 9am
    const tomorrow = new Date(Date.now() + 24 * 3600 * 1000);
    tomorrow.setHours(9, 0, 0, 0);
    const end = new Date(tomorrow.getTime() + 30 * 60000);

    await prisma.appointment.create({
        data: {
            doctorId: doctor.id,
            patientName: 'Jane User',
            patientEmail: 'jane@example.com',
            startTs: tomorrow,
            endTs: end,
            notes: 'Sample seeded appointment'
        }
    });

    console.log('Seeding complete.');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
