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

  const machiningDepartment = departmentRecords.find((department) => department.name === 'Machining');
  if (!machiningDepartment) {
    throw new Error('Missing Machining department seed');
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
    { name: 'Anodize', rateType: 'FLAT', rateCents: 0, description: 'External anodizing service.' },
    { name: 'Program / Setup', rateType: 'FLAT', rateCents: 0, description: 'Combined programming and setup time.' },
    { name: 'CNC Lathe', rateType: 'FLAT', rateCents: 0, description: 'CNC lathe operation planned.' },
    { name: 'CNC Mill', rateType: 'FLAT', rateCents: 0, description: 'CNC mill operation planned.' },
    { name: 'Manual Lathe', rateType: 'FLAT', rateCents: 0, description: 'Manual lathe operation planned.' },
    { name: 'Manual Mill', rateType: 'FLAT', rateCents: 0, description: 'Manual mill operation planned.' },
    { name: 'Weld / Fabricate', rateType: 'FLAT', rateCents: 0, description: 'Welding or fabrication required.' },
    { name: 'Stamp', rateType: 'FLAT', rateCents: 0, description: 'Stamping operation required.' },
    { name: 'Black Oxide', rateType: 'FLAT', rateCents: 0, description: 'Black oxide finish required.' },
    { name: 'Shop', rateType: 'FLAT', rateCents: 0, description: 'General shop work placeholder.' },
    { name: 'Scrap', rateType: 'FLAT', rateCents: 0, description: 'Scrap handling or recording.' },
    { name: 'Plating', rateType: 'FLAT', rateCents: 0, description: 'External plating service.' },
    { name: 'Powder Coating', rateType: 'FLAT', rateCents: 0, description: 'Powder coating service required.' },
    { name: 'Wet Paint', rateType: 'FLAT', rateCents: 0, description: 'Wet paint finish required.' },
    { name: 'Zinc', rateType: 'FLAT', rateCents: 0, description: 'Zinc finish required.' },
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
        departmentId: machiningDepartment.id,
      },
      create: { ...addon, departmentId: machiningDepartment.id },
    });
    addonRecords.push(record);
  }

  async function upsertCustomField({ entityType, name, key, fieldType, description, businessCode, isRequired, sortOrder, defaultValue, options }) {
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
        defaultValue,
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
        defaultValue,
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

    const template = existing
      ? await prisma.documentTemplate.update({
          where: { id: existing.id },
          data: {
            description,
            isActive: true,
            isDefault: true,
            schemaVersion,
            currentVersion: 1,
            layoutJson,
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
            layoutJson,
          },
        });

    await prisma.documentTemplateVersion.upsert({
      where: { templateId_version: { templateId: template.id, version: 1 } },
      update: { schemaVersion, layoutJson },
      create: {
        templateId: template.id,
        version: 1,
        schemaVersion,
        layoutJson,
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
