const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  // Materials
  for (const m of [
    { name: '1018 CRS', spec: 'Steel' },
    { name: '4140', spec: 'Alloy Steel' },
    { name: 'A2', spec: 'Tool Steel' },
    { name: '6061-T6', spec: 'Aluminum' },
    { name: '7075-T6', spec: 'Aluminum' },
    { name: '304SS', spec: 'Stainless' },
    { name: 'Brass 360', spec: 'Brass' },
  ]) {
    await prisma.material.upsert({ where: { name: m.name }, update: {}, create: m });
  }

  // Vendors
  for (const v of [
    { name: 'McMaster-Carr' },
    { name: 'Grainger' },
    { name: 'OnlineMetals' },
    { name: 'Yamazen' },
  ]) {
    await prisma.vendor.upsert({ where: { name: v.name }, update: {}, create: v });
  }

  const addonSeeds = [
    { name: 'Saw', rateType: 'HOURLY', rateCents: 7500, description: 'Saw cutting time per hour.' },
    { name: 'Weld', rateType: 'HOURLY', rateCents: 9000, description: 'Welding labor per hour.' },
    { name: 'Program Time', rateType: 'HOURLY', rateCents: 8500, description: 'CAM and CNC programming time.' },
    { name: 'Setup Time', rateType: 'HOURLY', rateCents: 7000, description: 'Machine setup labor per hour.' },
    { name: 'Mill Time', rateType: 'HOURLY', rateCents: 8200, description: 'Mill runtime per hour.' },
    { name: 'Lathe Time', rateType: 'HOURLY', rateCents: 7800, description: 'Lathe runtime per hour.' },
    { name: 'Flat Rate Handling', rateType: 'FLAT', rateCents: 2500, description: 'Fixed charge for handling or packaging.' },
    { name: 'Deburr', rateType: 'FLAT', rateCents: 0, description: 'Standard deburring process.' },
    { name: 'Heat Treat', rateType: 'FLAT', rateCents: 0, description: 'External heat treat service required.' },
    { name: 'Grind', rateType: 'FLAT', rateCents: 0, description: 'Grinding or surface finishing required.' },
    { name: 'Inspect', rateType: 'FLAT', rateCents: 0, description: 'Special inspection prior to shipment.' },
    { name: 'Paint', rateType: 'FLAT', rateCents: 0, description: 'Painting or coating service.' },
  ];

  const addonRecords = [];
  for (const addon of addonSeeds) {
    const record = await prisma.addon.upsert({
      where: { name: addon.name },
      update: {
        description: addon.description,
        rateType: addon.rateType,
        rateCents: addon.rateCents,
        active: true,
      },
      create: addon,
    });
    addonRecords.push(record);
  }

  // Customers
  const acme = await prisma.customer.upsert({
    where: { name: 'ACME Corp' },
    update: {},
    create: { name: 'ACME Corp' },
  });
  const wayne = await prisma.customer.upsert({
    where: { name: 'Wayne Industries' },
    update: {},
    create: { name: 'Wayne Industries' },
  });

  // Users
  const [admin, mach1, mach2, viewer] = await Promise.all([
    prisma.user.upsert({
      where: { email: 'admin@example.com' },
      update: {},
      create: { email: 'admin@example.com', name: 'Admin', role: 'ADMIN' },
    }),
    prisma.user.upsert({
      where: { email: 'mach1@example.com' },
      update: {},
      create: { email: 'mach1@example.com', name: 'Machinist One', role: 'MACHINIST' },
    }),
    prisma.user.upsert({
      where: { email: 'mach2@example.com' },
      update: {},
      create: { email: 'mach2@example.com', name: 'Machinist Two', role: 'MACHINIST' },
    }),
    prisma.user.upsert({
      where: { email: 'viewer@example.com' },
      update: {},
      create: { email: 'viewer@example.com', name: 'Viewer', role: 'VIEWER' },
    }),
  ]);

  const mats = await prisma.material.findMany();
  const checklistAddons = addonRecords.slice(0, 5);

  async function seedOrder(idx, customerId, assigned) {
    const ord = await prisma.order.create({
      data: {
        orderNumber: `SO-${1000 + idx}`,
        customerId,
        modelIncluded: idx % 2 === 0,
        receivedDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * (7 - idx)),
        dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * (idx + 2)),
        priority: ["NORMAL", "RUSH", "HOT"][idx % 3],
        status: "RECEIVED",
        assignedMachinistId: assigned ?? null,
        materialNeeded: idx % 2 === 1,
        materialOrdered: idx % 3 === 0,
        poNumber: idx % 2 === 0 ? `PO-${5000 + idx}` : null,
        parts: {
          create: [
            {
              partNumber: `P-${idx}-A`,
              quantity: 2 + (idx % 3),
              materialId: mats[idx % mats.length]?.id,
              notes: idx % 2 === 0 ? 'Critical surface finish' : null,
            },
          ],
        },
        checklist: {
          create: checklistAddons.slice(0, 3).map((addon) => ({ addonId: addon.id })),
        },
        statusHistory: { create: { from: "RECEIVED", to: "RECEIVED", userId: admin.id, reason: 'Seed' } },
      },
    });

    // sample timelog
    await prisma.timeLog.createMany({
      data: [
        { orderId: ord.id, userId: assigned ?? mach1.id, phase: "PROGRAMMING", minutes: 30 },
        { orderId: ord.id, userId: assigned ?? mach1.id, phase: "SETUP", minutes: 20 },
      ],
    });

    // sample note
    await prisma.note.create({
      data: { orderId: ord.id, userId: admin.id, content: 'Kickoff created.' },
    });
  }

  await seedOrder(1, acme.id, mach1.id);
  await seedOrder(2, acme.id, mach2.id);
  await seedOrder(3, wayne.id, mach1.id);
  await seedOrder(4, wayne.id, mach2.id);
  await seedOrder(5, acme.id, null);
  await seedOrder(6, acme.id, null);
  await seedOrder(7, wayne.id, mach1.id);
  await seedOrder(8, wayne.id, mach2.id);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
