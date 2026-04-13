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
  const materials = [
    { name: '1018 CRS', spec: 'Steel' },
    { name: '1020 HRS', spec: 'Steel' },
    { name: '1045', spec: 'Steel' },
    { name: '12L14', spec: 'Steel' },
    { name: '4140', spec: 'Alloy Steel' },
    { name: '4130', spec: 'Alloy Steel' },
    { name: 'A36 Plate', spec: 'Steel' },
    { name: 'A2', spec: 'Tool Steel' },
    { name: 'D2', spec: 'Tool Steel' },
    { name: 'O1', spec: 'Tool Steel' },
    { name: '6061-T6', spec: 'Aluminum' },
    { name: '7075-T6', spec: 'Aluminum' },
    { name: '2024-T351', spec: 'Aluminum' },
    { name: '5052-H32', spec: 'Aluminum' },
    { name: 'MIC-6', spec: 'Cast Aluminum Tooling Plate' },
    { name: '304 SS', spec: 'Stainless' },
    { name: '316 SS', spec: 'Stainless' },
    { name: '17-4 PH', spec: 'Stainless' },
    { name: 'Brass 360', spec: 'Brass' },
    { name: 'C110 Copper', spec: 'Copper' },
    { name: 'Acetal / Delrin', spec: 'Plastic' },
    { name: 'Nylon 6/6', spec: 'Plastic' },
    { name: 'UHMW', spec: 'Plastic' },
    { name: 'HDPE', spec: 'Plastic' },
    { name: 'PVC', spec: 'Plastic' },
    { name: 'Polycarbonate', spec: 'Plastic' },
    { name: 'ABS', spec: 'Plastic' },
    { name: 'PTFE / Teflon', spec: 'Plastic' },
    { name: 'PEEK', spec: 'Plastic' },
  ];

  const vendors = [{ name: 'McMaster-Carr' }, { name: 'Grainger' }];

  const departments = [
    { name: 'Machining', sortOrder: 0 },
    { name: 'Fab', sortOrder: 10 },
    { name: 'Paint', sortOrder: 20 },
    { name: 'Shipping', sortOrder: 30 },
  ];

  const addons = [
    { name: 'Program Time', rateType: 'HOURLY', rateCents: 8500, departmentName: 'Machining', isChecklistItem: false },
    { name: 'Setup Time', rateType: 'HOURLY', rateCents: 7000, departmentName: 'Machining', isChecklistItem: false },
    { name: 'Deburr', rateType: 'FLAT', rateCents: 0, departmentName: 'Machining', isChecklistItem: true },
    { name: 'Weld Time', rateType: 'HOURLY', rateCents: 9000, departmentName: 'Fab', isChecklistItem: false },
    { name: 'Powder Coat', rateType: 'FLAT', rateCents: 0, departmentName: 'Paint', isChecklistItem: true },
    { name: 'Packaging', rateType: 'FLAT', rateCents: 0, departmentName: 'Shipping', isChecklistItem: true },
  ];

  for (const material of materials) {
    await prisma.material.upsert({ where: { name: material.name }, update: {}, create: material });
  }

  for (const vendor of vendors) {
    await prisma.vendor.upsert({ where: { name: vendor.name }, update: {}, create: vendor });
  }

  const departmentRecords = [];
  for (const department of departments) {
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

  for (const addon of addons) {
    const department = departmentByName.get(addon.departmentName);
    if (!department) {
      throw new Error(`Missing ${addon.departmentName} department seed`);
    }

    await prisma.addon.upsert({
      where: { name: addon.name },
      update: {
        rateType: addon.rateType,
        rateCents: addon.rateCents,
        active: true,
        isChecklistItem: addon.isChecklistItem,
        departmentId: department.id,
      },
      create: {
        name: addon.name,
        rateType: addon.rateType,
        rateCents: addon.rateCents,
        active: true,
        isChecklistItem: addon.isChecklistItem,
        departmentId: department.id,
      },
    });
  }

  await prisma.customer.upsert({
    where: { name: 'Starter Customer' },
    update: { name: 'Starter Customer', phone: '555-0100' },
    create: {
      name: 'Starter Customer',
      email: 'buyer@example.com',
      phone: '555-0100',
      address: '123 Starter Ave',
    },
  });

  await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: { name: 'Admin User', role: 'ADMIN' },
    create: {
      email: 'admin@example.com',
      name: 'Admin User',
      role: 'ADMIN',
      passwordHash: null,
    },
  });

  console.log('Basic seed complete (foundational functionality data only).');
}

main()
  .catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
