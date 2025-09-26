import { PrismaClient } from '@prisma/client';

import { DEFAULT_QUOTE_METADATA, stringifyQuoteMetadata } from '../src/lib/quote-metadata';

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
  const vendorSeeds = [
    { name: 'McMaster-Carr' },
    { name: 'Grainger' },
    { name: 'OnlineMetals' },
    { name: 'Yamazen' },
  ];
  const vendorRecords = [] as Awaited<ReturnType<typeof prisma.vendor.upsert>>[];
  for (const v of vendorSeeds) {
    const record = await prisma.vendor.upsert({ where: { name: v.name }, update: {}, create: v });
    vendorRecords.push(record);
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
  const addonRecords = [] as Awaited<ReturnType<typeof prisma.addon.upsert>>[];
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

  async function seedOrder(idx: number, customerId: string, assigned?: string | null) {
    const ord = await prisma.order.create({
      data: {
        orderNumber: String(1000 + idx),
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

  const sawAddon = addonRecords.find((a) => a.name === 'Saw');
  const weldAddon = addonRecords.find((a) => a.name === 'Weld');
  const setupAddon = addonRecords.find((a) => a.name === 'Setup Time');
  const millAddon = addonRecords.find((a) => a.name === 'Mill Time');
  const mcmaster = vendorRecords.find((v) => v.name === 'McMaster-Carr');

  if (sawAddon && weldAddon && setupAddon && millAddon && mcmaster) {
    const sawTotal = Math.round(sawAddon.rateCents * 1.5);
    const weldTotal = Math.round(weldAddon.rateCents * 2.0);
    const setupTotal = Math.round(setupAddon.rateCents * 1.25);
    const millTotal = Math.round(millAddon.rateCents * 2.5);
    const addonsTotal = sawTotal + weldTotal + setupTotal + millTotal;
    const basePrice = 245000;
    const vendorPrice = Math.round(6800 * 1.2);
    await prisma.quote.upsert({
      where: { quoteNumber: 'Q-1001' },
      update: {},
      create: {
        quoteNumber: 'Q-1001',
        companyName: 'ACME Corp',
        contactName: 'Jane Engineer',
        contactEmail: 'jane.engineer@acme.example',
        contactPhone: '555-0102',
        customerId: acme.id,
        status: 'DRAFT',
        materialSummary: '6061-T6 plate and DOM tubing per print.',
        purchaseItems: 'Hardware kit, anchors, powder coat service TBD.',
        requirements: 'Tube welded to base, grind flush, powder coat black.',
        basePriceCents: basePrice,
        vendorTotalCents: vendorPrice,
        addonsTotalCents: addonsTotal,
        totalCents: basePrice + vendorPrice + addonsTotal,
        multiPiece: true,
        notes: 'Initial quote prepared from legacy spreadsheet.',
        createdById: admin.id,
        metadata: stringifyQuoteMetadata({
          ...DEFAULT_QUOTE_METADATA,
          markupNotes: 'Vendor markup applied at 20%. Labor captured via addons.',
        }),
        parts: {
          create: [
            {
              name: 'Base and Tube Assembly',
              description: 'Base plate with welded tube; machine critical faces after welding.',
              quantity: 1,
              pieceCount: 2,
              notes: 'Includes weld prep and machining of finished assembly.',
            },
          ],
        },
        vendorItems: {
          create: [
            {
              vendorId: mcmaster.id,
              vendorName: mcmaster.name,
              partNumber: '91251A289',
              partUrl: 'https://www.mcmaster.com/91251A289/',
              basePriceCents: 6800,
              markupPercent: 20,
              finalPriceCents: vendorPrice,
              notes: 'Fastener kit per customer spec.',
            },
          ],
        },
        addonSelections: {
          create: [
            {
              addonId: sawAddon.id,
              units: 1.5,
              rateTypeSnapshot: sawAddon.rateType,
              rateCents: sawAddon.rateCents,
              totalCents: sawTotal,
              notes: 'Cut raw stock for base and tube.',
            },
            {
              addonId: weldAddon.id,
              units: 2.0,
              rateTypeSnapshot: weldAddon.rateType,
              rateCents: weldAddon.rateCents,
              totalCents: weldTotal,
              notes: 'Weld assembly with fixture.',
            },
            {
              addonId: setupAddon.id,
              units: 1.25,
              rateTypeSnapshot: setupAddon.rateType,
              rateCents: setupAddon.rateCents,
              totalCents: setupTotal,
              notes: 'Fixture and machine setup.',
            },
            {
              addonId: millAddon.id,
              units: 2.5,
              rateTypeSnapshot: millAddon.rateType,
              rateCents: millAddon.rateCents,
              totalCents: millTotal,
              notes: 'Finish mill passes on assembly.',
            },
          ],
        },
        attachments: {
          create: [
            {
              url: 'https://example.com/quotes/Q-1001/customer-print.pdf',
              label: 'Customer print',
            },
          ],
        },
      },
    });
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
