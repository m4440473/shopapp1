const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function slugifyName(value, fallback = 'item') {
  const normalized = `${value ?? ''}`
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || fallback;
}

async function main() {
  const businessCodes = ['STD', 'CRM', 'PC'];
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

  const departmentSeeds = [
    { name: 'Machining', sortOrder: 0 },
    { name: 'Fab', sortOrder: 10 },
    { name: 'Paint', sortOrder: 20 },
    { name: 'Shipping', sortOrder: 30 },
  ];
  const departmentRecords = [];
  for (const department of departmentSeeds) {
    const record = await prisma.department.upsert({
      where: { name: department.name },
      update: {
        sortOrder: department.sortOrder,
        isActive: true,
        slug: slugifyName(department.name, 'department'),
      },
      create: {
        ...department,
        isActive: true,
        slug: slugifyName(department.name, 'department'),
      },
    });
    departmentRecords.push(record);
  }

  const departmentByName = new Map(departmentRecords.map((department) => [department.name, department]));

  const addonSeeds = [
    { name: 'Program Time', rateType: 'HOURLY', rateCents: 8500, departmentName: 'Machining' },
    { name: 'Setup Time', rateType: 'HOURLY', rateCents: 7000, departmentName: 'Machining' },
    { name: 'Mill Time', rateType: 'HOURLY', rateCents: 8200, departmentName: 'Machining' },
    { name: 'Lathe Time', rateType: 'HOURLY', rateCents: 7800, departmentName: 'Machining' },
    { name: 'Saw Cut', rateType: 'HOURLY', rateCents: 7500, departmentName: 'Machining' },
    { name: 'Deburr', rateType: 'FLAT', rateCents: 0, departmentName: 'Machining' },
    { name: 'Break edges / chamfer', rateType: 'FLAT', rateCents: 0, departmentName: 'Machining' },
    { name: 'Verify critical dims', rateType: 'FLAT', rateCents: 0, departmentName: 'Machining' },
    { name: 'In-process inspection', rateType: 'FLAT', rateCents: 0, departmentName: 'Machining' },
    { name: 'Final inspection', rateType: 'FLAT', rateCents: 0, departmentName: 'Machining' },
    { name: 'Clean part', rateType: 'FLAT', rateCents: 0, departmentName: 'Machining' },
    { name: 'Weld Time', rateType: 'HOURLY', rateCents: 9000, departmentName: 'Fab' },
    { name: 'Fit-up / Tack', rateType: 'HOURLY', rateCents: 8500, departmentName: 'Fab' },
    { name: 'Grind/Blend', rateType: 'HOURLY', rateCents: 8000, departmentName: 'Fab' },
    { name: 'Cut stock for fab', rateType: 'FLAT', rateCents: 0, departmentName: 'Fab' },
    { name: 'Prep joints', rateType: 'FLAT', rateCents: 0, departmentName: 'Fab' },
    { name: 'Weld complete', rateType: 'FLAT', rateCents: 0, departmentName: 'Fab' },
    { name: 'Blend/finish welds', rateType: 'FLAT', rateCents: 0, departmentName: 'Fab' },
    { name: 'Powder Coat', rateType: 'FLAT', rateCents: 0, departmentName: 'Paint' },
    { name: 'Wet Paint', rateType: 'FLAT', rateCents: 0, departmentName: 'Paint' },
    { name: 'Anodize', rateType: 'FLAT', rateCents: 0, departmentName: 'Paint' },
    { name: 'Black Oxide', rateType: 'FLAT', rateCents: 0, departmentName: 'Paint' },
    { name: 'Plating', rateType: 'FLAT', rateCents: 0, departmentName: 'Paint' },
    { name: 'Zinc', rateType: 'FLAT', rateCents: 0, departmentName: 'Paint' },
    { name: 'Masking', rateType: 'FLAT', rateCents: 0, departmentName: 'Paint' },
    { name: 'Surface prep / scuff', rateType: 'FLAT', rateCents: 0, departmentName: 'Paint' },
    { name: 'Cure complete', rateType: 'FLAT', rateCents: 0, departmentName: 'Paint' },
    { name: 'Color match verified', rateType: 'FLAT', rateCents: 0, departmentName: 'Paint' },
    { name: 'Flat Rate Handling', rateType: 'FLAT', rateCents: 0, departmentName: 'Shipping' },
    { name: 'Packaging', rateType: 'FLAT', rateCents: 0, departmentName: 'Shipping' },
    { name: 'Palletize', rateType: 'FLAT', rateCents: 0, departmentName: 'Shipping' },
    { name: 'Bag & tag', rateType: 'FLAT', rateCents: 0, departmentName: 'Shipping' },
    { name: 'Label parts', rateType: 'FLAT', rateCents: 0, departmentName: 'Shipping' },
    { name: 'Include paperwork', rateType: 'FLAT', rateCents: 0, departmentName: 'Shipping' },
    { name: 'Verify quantity', rateType: 'FLAT', rateCents: 0, departmentName: 'Shipping' },
    { name: 'Ship complete', rateType: 'FLAT', rateCents: 0, departmentName: 'Shipping' },
  ];

  const addonRecords = [];
  for (const addon of addonSeeds) {
    const department = departmentByName.get(addon.departmentName);
    if (!department) {
      throw new Error(`Missing ${addon.departmentName} department seed`);
    }
    const record = await prisma.addon.upsert({
      where: { name: addon.name },
      update: {
        rateType: addon.rateType,
        rateCents: addon.rateCents,
        active: true,
        departmentId: department.id,
      },
      create: {
        name: addon.name,
        rateType: addon.rateType,
        rateCents: addon.rateCents,
        active: true,
        departmentId: department.id,
      },
    });
    addonRecords.push(record);
  }

  function serializeJsonValue(value) {
    if (value === undefined) return null;
    return JSON.stringify(value);
  }

  async function upsertCustomField({ entityType, name, key, fieldType, description, businessCode, isRequired, sortOrder, defaultValue, options }) {
    const defaultValueSerialized = serializeJsonValue(defaultValue);
    const field = await prisma.customField.upsert({
      where: { key },
      update: {
        name,
        entityType,
        fieldType,
        description,
        businessCode,
        isRequired,
        sortOrder,
        isActive: true,
        defaultValue: defaultValueSerialized,
      },
      create: {
        name,
        key,
        entityType,
        fieldType,
        description,
        businessCode,
        isRequired,
        sortOrder,
        isActive: true,
        defaultValue: defaultValueSerialized,
      },
    });

    if (options?.length) {
      await prisma.customFieldOption.deleteMany({ where: { fieldId: field.id } });
      await prisma.customFieldOption.createMany({
        data: options.map((option, index) => ({
          fieldId: field.id,
          label: option.label,
          value: option.value,
          sortOrder: option.sortOrder ?? index,
          isActive: option.isActive ?? true,
        })),
      });
    }

    return field;
  }

  async function upsertTemplate({ name, documentType, description, businessCode, schemaVersion, layoutJson }) {
    const existing = await prisma.documentTemplate.findFirst({
      where: { name, documentType, businessCode: businessCode ?? null },
    });

    const serializedLayout = JSON.stringify(layoutJson);
    const template = existing
      ? await prisma.documentTemplate.update({
          where: { id: existing.id },
          data: {
            description,
            isActive: true,
            isDefault: true,
            schemaVersion,
            currentVersion: 1,
            layoutJson: serializedLayout,
          },
        })
      : await prisma.documentTemplate.create({
          data: {
            name,
            documentType,
            description,
            businessCode,
            isActive: true,
            isDefault: true,
            schemaVersion,
            currentVersion: 1,
            layoutJson: serializedLayout,
          },
        });

    await prisma.documentTemplateVersion.upsert({
      where: { templateId_version: { templateId: template.id, version: 1 } },
      update: { schemaVersion, layoutJson: serializedLayout },
      create: {
        templateId: template.id,
        version: 1,
        schemaVersion,
        layoutJson: serializedLayout,
      },
    });

    return template;
  }

  const layoutSections = [
    { id: 'header', label: 'Header', type: 'HEADER' },
    { id: 'customer_info', label: 'Customer Info', type: 'CUSTOMER_INFO' },
    { id: 'total_price', label: 'Total Price', type: 'TOTAL_PRICE' },
    { id: 'part_name', label: 'Part Name', type: 'PART_NAME' },
    { id: 'part_info', label: 'Part Info', type: 'PART_INFO' },
    { id: 'line_items', label: 'Line Items', type: 'LINE_ITEMS' },
    { id: 'addons_labor', label: 'Addons / Labor', type: 'ADDONS_LABOR' },
    { id: 'shipping', label: 'Shipping', type: 'SHIPPING' },
  ];

  const baseLayout = {
    schemaVersion: 1,
    sections: layoutSections.map((section, index) => ({
      ...section,
      enabled: true,
      order: index + 1,
      settings: {},
    })),
  };

  for (const businessCode of businessCodes) {
    await upsertCustomField({
      entityType: 'ORDER',
      name: 'Delivery Method',
      key: `order_delivery_method_${businessCode}`,
      fieldType: 'SELECT',
      description: 'Preferred delivery method for the order.',
      businessCode,
      isRequired: true,
      sortOrder: 10,
      defaultValue: 'pickup',
      options: [
        { label: 'Pickup', value: 'pickup' },
        { label: 'Delivery', value: 'delivery' },
        { label: 'Freight', value: 'freight' },
      ],
    });

    await upsertCustomField({
      entityType: 'ORDER',
      name: 'Order Intake Notes',
      key: `order_intake_notes_${businessCode}`,
      fieldType: 'LONG_TEXT',
      description: 'Internal intake notes captured at order creation.',
      businessCode,
      isRequired: false,
      sortOrder: 20,
    });

    await upsertCustomField({
      entityType: 'QUOTE',
      name: 'Lead Time (days)',
      key: `quote_lead_time_${businessCode}`,
      fieldType: 'NUMBER',
      description: 'Estimated lead time for the quote.',
      businessCode,
      isRequired: true,
      sortOrder: 10,
      defaultValue: 10,
    });

    await upsertCustomField({
      entityType: 'QUOTE',
      name: 'Finish Required',
      key: `quote_finish_required_${businessCode}`,
      fieldType: 'SELECT',
      description: 'Required finish for the quoted parts.',
      businessCode,
      isRequired: false,
      sortOrder: 20,
      options: [
        { label: 'None', value: 'none' },
        { label: 'Anodize', value: 'anodize' },
        { label: 'Powder Coat', value: 'powder_coat' },
        { label: 'Paint', value: 'paint' },
      ],
    });

    await upsertTemplate({
      name: `Default ${businessCode} Quote`,
      documentType: 'QUOTE',
      description: 'Default quote layout template.',
      businessCode,
      schemaVersion: 1,
      layoutJson: baseLayout,
    });

    await upsertTemplate({
      name: `Default ${businessCode} Invoice`,
      documentType: 'INVOICE',
      description: 'Default invoice layout template.',
      businessCode,
      schemaVersion: 1,
      layoutJson: baseLayout,
    });

    await upsertTemplate({
      name: `Default ${businessCode} Order Print`,
      documentType: 'ORDER_PRINT',
      description: 'Default order print layout template.',
      businessCode,
      schemaVersion: 1,
      layoutJson: baseLayout,
    });
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

  async function seedOrder(idx, customerId, assigned, business) {
    const ord = await prisma.order.create({
      data: {
        orderNumber: `${business}-${1000 + idx}`,
        business,
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

  await seedOrder(1, acme.id, mach1.id, 'STD');
  await seedOrder(2, acme.id, mach2.id, 'STD');
  await seedOrder(3, wayne.id, mach1.id, 'CRM');
  await seedOrder(4, wayne.id, mach2.id, 'CRM');
  await seedOrder(5, acme.id, null, 'STD');
  await seedOrder(6, acme.id, null, 'STD');
  await seedOrder(7, wayne.id, mach1.id, 'PC');
  await seedOrder(8, wayne.id, mach2.id, 'PC');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
