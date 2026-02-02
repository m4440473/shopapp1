import { Prisma, PrismaClient } from '@prisma/client';

import { DEFAULT_QUOTE_METADATA, stringifyQuoteMetadata } from '../src/lib/quote-metadata';
import { BUSINESS_CODE_VALUES, slugifyName } from '../src/lib/businesses';

const prisma = new PrismaClient();

async function main() {
  const businessCodes = BUSINESS_CODE_VALUES;
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

  const departmentSeeds = [
    { name: 'Machining', sortOrder: 0 },
    { name: 'Fab', sortOrder: 10 },
    { name: 'Paint', sortOrder: 20 },
    { name: 'Shipping', sortOrder: 30 },
  ];
  const departmentRecords = [] as Awaited<ReturnType<typeof prisma.department.upsert>>[];
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
  const addonRecords = [] as Awaited<ReturnType<typeof prisma.addon.upsert>>[];
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

  function serializeJsonValue(value: unknown) {
    if (value === undefined) return null;
    return JSON.stringify(value);
  }

  async function upsertCustomField({
    entityType,
    name,
    key,
    fieldType,
    description,
    businessCode,
    isRequired,
    sortOrder,
    defaultValue,
    options,
  }: {
    entityType: 'ORDER' | 'QUOTE';
    name: string;
    key: string;
    fieldType: 'TEXT' | 'LONG_TEXT' | 'NUMBER' | 'DATE' | 'BOOLEAN' | 'SELECT' | 'MULTISELECT';
    description?: string;
    businessCode?: string;
    isRequired: boolean;
    sortOrder: number;
    defaultValue?: unknown;
    options?: { label: string; value: string; sortOrder?: number; isActive?: boolean }[];
  }) {
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

  async function upsertTemplate({
    name,
    documentType,
    description,
    businessCode,
    schemaVersion,
    layoutJson,
  }: {
    name: string;
    documentType: 'QUOTE' | 'INVOICE' | 'ORDER_PRINT';
    description: string;
    businessCode: string;
    schemaVersion: number;
    layoutJson: unknown;
  }) {
    const existing = await prisma.documentTemplate.findFirst({
      where: { name, documentType, businessCode },
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
      uiSection: 'PART_BUILD',
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
  const addonByName = new Map(addonRecords.map((addon) => [addon.name, addon]));
  const addonGroups = [
    ['Program Time', 'Setup Time', 'Mill Time'],
    ['Saw Cut', 'Deburr', 'Verify critical dims'],
    ['Weld Time', 'Fit-up / Tack', 'Grind/Blend'],
    ['Powder Coat', 'Masking', 'Cure complete'],
    ['Packaging', 'Label parts', 'Verify quantity'],
  ];
  const partTemplates = [
    { suffix: 'A', notes: 'Critical surface finish on datum face.', stockSize: '1/2" plate', cutLength: '10 in' },
    { suffix: 'B', notes: 'Drill/tap pattern per print.', stockSize: '1" bar', cutLength: '6 in' },
    { suffix: 'C', notes: 'Weldment requires alignment check.', stockSize: '2x2 tube', cutLength: '18 in' },
  ];

  function buildAddonsForPart(partIndex: number) {
    const names = addonGroups[partIndex % addonGroups.length] ?? [];
    return names
      .map((name) => addonByName.get(name))
      .filter((addon): addon is (typeof addonRecords)[number] => Boolean(addon));
  }

  async function seedOrder(
    idx: number,
    customerId: string,
    assigned: string | null = null,
    business: 'STD' | 'CRM' | 'PC',
  ) {
    const orderNumber = `${business}-${1000 + idx}`;
    const partCount = 2 + (idx % 2);
    const partSeeds = Array.from({ length: partCount }).map((_, partIndex) => {
      const template = partTemplates[partIndex % partTemplates.length];
      return {
        partNumber: `P-${idx}-${template.suffix}`,
        quantity: 2 + ((idx + partIndex) % 3),
        materialId: mats[(idx + partIndex) % mats.length]?.id,
        notes: template.notes,
        stockSize: template.stockSize,
        cutLength: template.cutLength,
      };
    });

    const ord = await prisma.order.create({
      data: {
        orderNumber,
        business,
        customerId,
        modelIncluded: idx % 2 === 0,
        receivedDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * (7 - idx)),
        dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * (idx + 2)),
        priority: ['NORMAL', 'RUSH', 'HOT'][idx % 3],
        status: 'RECEIVED',
        assignedMachinistId: assigned ?? null,
        materialNeeded: idx % 2 === 1,
        materialOrdered: idx % 3 === 0,
        poNumber: idx % 2 === 0 ? `PO-${5000 + idx}` : null,
        parts: {
          create: partSeeds,
        },
        statusHistory: {
          create: { from: 'RECEIVED', to: 'RECEIVED', userId: admin.id, reason: 'Seed' },
        },
      },
      include: { parts: true },
    });

    const checklistData: Prisma.OrderChecklistCreateManyInput[] = [];
    const chargeData: Prisma.OrderChargeCreateManyInput[] = [];
    ord.parts.forEach((part, partIndex) => {
      const addons = buildAddonsForPart(partIndex);
      addons.forEach((addon, addonIndex) => {
        checklistData.push({
          orderId: ord.id,
          partId: part.id,
          addonId: addon.id,
          departmentId: addon.departmentId,
          completed: addonIndex === 0 && idx % 3 === 0,
        });
        chargeData.push({
          orderId: ord.id,
          partId: part.id,
          departmentId: addon.departmentId,
          addonId: addon.id,
          kind: 'ADDON',
          name: addon.name,
          description: `Seeded ${addon.name.toLowerCase()} charge.`,
          quantity: new Prisma.Decimal(1),
          unitPrice: new Prisma.Decimal(addon.rateCents / 100),
          sortOrder: addonIndex,
        });
      });
    });

    if (checklistData.length) {
      await prisma.orderChecklist.createMany({ data: checklistData });
    }
    if (chargeData.length) {
      await prisma.orderCharge.createMany({ data: chargeData });
    }

    await prisma.timeLog.createMany({
      data: [
        { orderId: ord.id, userId: assigned ?? mach1.id, phase: 'PROGRAMMING', minutes: 30 },
        { orderId: ord.id, userId: assigned ?? mach1.id, phase: 'SETUP', minutes: 20 },
      ],
    });

    const timeEntryData: Prisma.TimeEntryCreateManyInput[] = [];
    const timeBase = Date.now() - 1000 * 60 * 60 * 24 * idx;
    ord.parts.forEach((part, partIndex) => {
      const firstStart = new Date(timeBase + 1000 * 60 * (30 + partIndex * 15));
      const firstEnd = new Date(firstStart.getTime() + 1000 * 60 * (18 + partIndex * 4));
      const secondStart = new Date(firstEnd.getTime() + 1000 * 60 * 12);
      const secondEnd = new Date(secondStart.getTime() + 1000 * 60 * (22 + partIndex * 3));
      timeEntryData.push(
        {
          orderId: ord.id,
          partId: part.id,
          userId: assigned ?? mach1.id,
          operation: 'Machining',
          startedAt: firstStart,
          endedAt: firstEnd,
        },
        {
          orderId: ord.id,
          partId: part.id,
          userId: assigned ?? mach1.id,
          operation: 'Inspection',
          startedAt: secondStart,
          endedAt: secondEnd,
        },
      );
    });

    await prisma.timeEntry.createMany({ data: timeEntryData });

    await prisma.note.create({
      data: { orderId: ord.id, userId: admin.id, content: 'Kickoff created.' },
    });
  }

  const orderSeeds = [
    { idx: 1, customerId: acme.id, assigned: mach1.id, business: 'STD' },
    { idx: 2, customerId: acme.id, assigned: mach2.id, business: 'STD' },
    { idx: 3, customerId: wayne.id, assigned: mach1.id, business: 'CRM' },
    { idx: 4, customerId: wayne.id, assigned: mach2.id, business: 'CRM' },
    { idx: 5, customerId: acme.id, assigned: null, business: 'STD' },
    { idx: 6, customerId: acme.id, assigned: null, business: 'STD' },
    { idx: 7, customerId: wayne.id, assigned: mach1.id, business: 'PC' },
    { idx: 8, customerId: wayne.id, assigned: mach2.id, business: 'PC' },
    { idx: 9, customerId: acme.id, assigned: mach1.id, business: 'CRM' },
    { idx: 10, customerId: wayne.id, assigned: mach2.id, business: 'STD' },
  ];

  for (const seed of orderSeeds) {
    await seedOrder(seed.idx, seed.customerId, seed.assigned, seed.business);
  }

  const mcmaster = vendorRecords.find((v) => v.name === 'McMaster-Carr');
  const grainger = vendorRecords.find((v) => v.name === 'Grainger');
  const quoteAddons = addonRecords.filter((addon) =>
    ['Setup Time', 'Mill Time', 'Weld Time', 'Powder Coat', 'Packaging'].includes(addon.name),
  );

  if (mcmaster && grainger && quoteAddons.length >= 3) {
    const quoteSeeds = [
      {
        quoteNumber: 'STD-20231015-0001',
        business: 'STD',
        companyName: 'ACME Corp',
        contactName: 'Jane Engineer',
        contactEmail: 'jane.engineer@acme.example',
        contactPhone: '555-0102',
        customerId: acme.id,
        status: 'DRAFT',
        materialSummary: '6061-T6 plate and DOM tubing per print.',
        purchaseItems: 'Hardware kit, anchors, powder coat service TBD.',
        requirements: 'Tube welded to base, grind flush, powder coat black.',
        basePriceCents: 245000,
        vendor: mcmaster,
        vendorBasePrice: 6800,
        vendorMarkup: 20,
        parts: [
          {
            name: 'Base and Tube Assembly',
            description: 'Base plate with welded tube; machine critical faces after welding.',
            quantity: 1,
            pieceCount: 2,
            notes: 'Includes weld prep and machining of finished assembly.',
          },
        ],
      },
      {
        quoteNumber: 'CRM-20231020-0002',
        business: 'CRM',
        companyName: 'Wayne Industries',
        contactName: 'Luke Fox',
        contactEmail: 'luke.fox@wayne.example',
        contactPhone: '555-0110',
        customerId: wayne.id,
        status: 'SENT',
        materialSummary: '7075-T6 bar stock and powder coat finish.',
        purchaseItems: 'COTS spacers, sealant.',
        requirements: 'Machine, deburr, and powder coat per spec.',
        basePriceCents: 178500,
        vendor: grainger,
        vendorBasePrice: 5400,
        vendorMarkup: 15,
        parts: [
          {
            name: 'Machined Bracket Set',
            description: 'Three-axis machined brackets, powder coat black.',
            quantity: 4,
            pieceCount: 4,
            notes: 'Hold +/-0.002 on mating surfaces.',
          },
          {
            name: 'Spacer Kit',
            description: 'Anodized spacers, include verification report.',
            quantity: 1,
            pieceCount: 6,
            notes: 'Inspect OD and length before anodize.',
          },
        ],
      },
      {
        quoteNumber: 'PC-20231025-0003',
        business: 'PC',
        companyName: 'ACME Corp',
        contactName: 'Olivia Plant',
        contactEmail: 'olivia.plant@acme.example',
        contactPhone: '555-0123',
        customerId: acme.id,
        status: 'APPROVED',
        materialSummary: '304SS tubing, TIG weld, polish.',
        purchaseItems: 'Gasket kit.',
        requirements: 'Polish to 180 grit, weld and leak test.',
        basePriceCents: 312000,
        vendor: mcmaster,
        vendorBasePrice: 9600,
        vendorMarkup: 18,
        parts: [
          {
            name: 'Stainless Enclosure',
            description: 'Welded enclosure with polished finish.',
            quantity: 1,
            pieceCount: 1,
            notes: 'Leak test after welding.',
          },
        ],
      },
      {
        quoteNumber: 'STD-20231102-0004',
        business: 'STD',
        companyName: 'Wayne Industries',
        contactName: 'Harper Crane',
        contactEmail: 'harper.crane@wayne.example',
        contactPhone: '555-0128',
        customerId: wayne.id,
        status: 'DRAFT',
        materialSummary: 'A2 tool steel, heat treat after machining.',
        purchaseItems: 'Heat treat service, fastener kit.',
        requirements: 'Hold true position on dowel holes.',
        basePriceCents: 95000,
        vendor: grainger,
        vendorBasePrice: 4200,
        vendorMarkup: 12,
        parts: [
          {
            name: 'Fixture Plate',
            description: 'Ground fixture plate with dowel pin pattern.',
            quantity: 2,
            pieceCount: 2,
            notes: 'Heat treat after rough machining.',
          },
        ],
      },
      {
        quoteNumber: 'CRM-20231108-0005',
        business: 'CRM',
        companyName: 'ACME Corp',
        contactName: 'Ivy Planner',
        contactEmail: 'ivy.planner@acme.example',
        contactPhone: '555-0131',
        customerId: acme.id,
        status: 'SENT',
        materialSummary: '6061 sheet metal, powder coat white.',
        purchaseItems: 'PEM hardware and hinges.',
        requirements: 'Formed and powder coat, inspect dimensions.',
        basePriceCents: 128000,
        vendor: mcmaster,
        vendorBasePrice: 7500,
        vendorMarkup: 10,
        parts: [
          {
            name: 'Control Panel Cover',
            description: 'Sheet metal panel with PEM inserts.',
            quantity: 3,
            pieceCount: 3,
            notes: 'Check flatness after forming.',
          },
        ],
      },
      {
        quoteNumber: 'PC-20231112-0006',
        business: 'PC',
        companyName: 'Wayne Industries',
        contactName: 'Reese Allen',
        contactEmail: 'reese.allen@wayne.example',
        contactPhone: '555-0145',
        customerId: wayne.id,
        status: 'APPROVED',
        materialSummary: '4140 pre-hard with black oxide finish.',
        purchaseItems: 'Threaded inserts.',
        requirements: 'Machine OD, deburr, black oxide.',
        basePriceCents: 164000,
        vendor: grainger,
        vendorBasePrice: 6100,
        vendorMarkup: 16,
        parts: [
          {
            name: 'Drive Hub',
            description: 'Turned hub with keyway.',
            quantity: 2,
            pieceCount: 2,
            notes: 'Inspect runout after machining.',
          },
        ],
      },
      {
        quoteNumber: 'STD-20231118-0007',
        business: 'STD',
        companyName: 'ACME Corp',
        contactName: 'Noah Mills',
        contactEmail: 'noah.mills@acme.example',
        contactPhone: '555-0149',
        customerId: acme.id,
        status: 'SENT',
        materialSummary: '7075-T6 billet and anodize.',
        purchaseItems: 'Hardware kit and packaging.',
        requirements: 'Anodize clear, inspect hole pattern.',
        basePriceCents: 210000,
        vendor: mcmaster,
        vendorBasePrice: 8200,
        vendorMarkup: 14,
        parts: [
          {
            name: 'Machined Housing',
            description: 'Pocketed housing with anodize finish.',
            quantity: 1,
            pieceCount: 1,
            notes: 'Measure pocket depths before anodize.',
          },
        ],
      },
      {
        quoteNumber: 'CRM-20231122-0008',
        business: 'CRM',
        companyName: 'Wayne Industries',
        contactName: 'Avery Stone',
        contactEmail: 'avery.stone@wayne.example',
        contactPhone: '555-0152',
        customerId: wayne.id,
        status: 'DRAFT',
        materialSummary: '1018 CRS and welded assembly.',
        purchaseItems: 'Hardware kit, inspection report.',
        requirements: 'Weld and grind flush, paint gray.',
        basePriceCents: 98000,
        vendor: grainger,
        vendorBasePrice: 4300,
        vendorMarkup: 12,
        parts: [
          {
            name: 'Support Frame',
            description: 'Welded frame, paint gray.',
            quantity: 1,
            pieceCount: 1,
            notes: 'Verify squareness after welding.',
          },
        ],
      },
      {
        quoteNumber: 'PC-20231128-0009',
        business: 'PC',
        companyName: 'ACME Corp',
        contactName: 'Quinn Harper',
        contactEmail: 'quinn.harper@acme.example',
        contactPhone: '555-0161',
        customerId: acme.id,
        status: 'APPROVED',
        materialSummary: 'Brass 360, polish finish.',
        purchaseItems: 'Packaging inserts.',
        requirements: 'Turned parts with polished finish.',
        basePriceCents: 72000,
        vendor: mcmaster,
        vendorBasePrice: 3200,
        vendorMarkup: 10,
        parts: [
          {
            name: 'Brass Cap',
            description: 'Turned cap with polished finish.',
            quantity: 6,
            pieceCount: 6,
            notes: 'Inspect surface finish.',
          },
        ],
      },
      {
        quoteNumber: 'STD-20231202-0010',
        business: 'STD',
        companyName: 'Wayne Industries',
        contactName: 'Jordan Kent',
        contactEmail: 'jordan.kent@wayne.example',
        contactPhone: '555-0174',
        customerId: wayne.id,
        status: 'SENT',
        materialSummary: '6061 plate with black anodize.',
        purchaseItems: 'Fasteners, gasket kit.',
        requirements: 'Machine and anodize, include inspection report.',
        basePriceCents: 134000,
        vendor: grainger,
        vendorBasePrice: 5800,
        vendorMarkup: 14,
        parts: [
          {
            name: 'Machine Base',
            description: 'Base plate with counterbores.',
            quantity: 2,
            pieceCount: 2,
            notes: 'Inspect flatness before anodize.',
          },
        ],
      },
    ];

    for (const seed of quoteSeeds) {
      const addonSlice = quoteAddons.slice(0, 3);
      const addonSelectionData = addonSlice.map((addon, index) => ({
        addonId: addon.id,
        units: 1 + index * 0.5,
        rateTypeSnapshot: addon.rateType,
        rateCents: addon.rateCents,
        totalCents: Math.round(addon.rateCents * (1 + index * 0.5)),
        notes: `Seeded ${addon.name.toLowerCase()} coverage.`,
      }));
      const addonsTotal = addonSelectionData.reduce((sum, addon) => sum + addon.totalCents, 0);
      const vendorPrice = Math.round(seed.vendorBasePrice * (1 + seed.vendorMarkup / 100));
      await prisma.quote.upsert({
        where: { quoteNumber: seed.quoteNumber },
        update: {},
        create: {
          quoteNumber: seed.quoteNumber,
          business: seed.business,
          companyName: seed.companyName,
          contactName: seed.contactName,
          contactEmail: seed.contactEmail,
          contactPhone: seed.contactPhone,
          customerId: seed.customerId,
          status: seed.status,
          materialSummary: seed.materialSummary,
          purchaseItems: seed.purchaseItems,
          requirements: seed.requirements,
          basePriceCents: seed.basePriceCents,
          vendorTotalCents: vendorPrice,
          addonsTotalCents: addonsTotal,
          totalCents: seed.basePriceCents + vendorPrice + addonsTotal,
          multiPiece: seed.parts.length > 1,
          notes: 'Seeded quote for demo workflow.',
          createdById: admin.id,
          metadata: stringifyQuoteMetadata({
            ...DEFAULT_QUOTE_METADATA,
            markupNotes: 'Seed data: vendor markup and addon labor captured.',
          }),
          parts: {
            create: seed.parts,
          },
          vendorItems: {
            create: [
              {
                vendorId: seed.vendor.id,
                vendorName: seed.vendor.name,
                partNumber: 'KIT-ASSY-001',
                partUrl: 'https://www.mcmaster.com/',
                basePriceCents: seed.vendorBasePrice,
                markupPercent: seed.vendorMarkup,
                finalPriceCents: vendorPrice,
                notes: 'Seeded vendor package.',
              },
            ],
          },
          addonSelections: {
            create: addonSelectionData,
          },
          attachments: {
            create: [
              {
                url: `https://example.com/quotes/${seed.quoteNumber}/customer-print.pdf`,
                label: 'Customer print',
              },
            ],
          },
        },
      });
    }
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
