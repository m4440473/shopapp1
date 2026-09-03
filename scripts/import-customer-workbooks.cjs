#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const XLSX = require('xlsx');
const { PrismaClient } = require('@prisma/client');

const SOURCE_CONFIG = [
  { businessCode: 'STD', filePattern: /sterling.*customer/i, columns: { name: 0, billTo: 2, contact: 4, phone: 6, fax: 8 } },
  { businessCode: 'CRM', filePattern: /cr.*customer/i, columns: { name: 1, billTo: 2, contact: 3, phone: 4, fax: 5 } },
  { businessCode: 'PC', filePattern: /pkp.*customer/i, columns: { name: 1, billTo: 2, contact: 3, phone: 4, fax: 5 } },
];

const SKIP_KEYS = new Set(['acctg adj', 'ach', 'srvc cntr']);
const CITY_NAMES = [
  'Auburn Hills', 'Bonita Springs', 'Cherry Blossom Way Georgetown', 'New York', 'St. Albans',
  'Union Grove', 'Nicholasville', 'Lawrenceburg', 'Harrodsburg', 'Georgetown', 'Minneapolis',
  'Huntsville', 'Mandeville', 'Lexington', 'Versailles', 'Lancaster', 'Winchester', 'Frankfort',
  'Cambridge', 'Corning', 'Wilmore', 'Danville', 'Richmond', 'Berea', 'Carlisle', 'Glasgow', 'Hazard',
  'Columbus', 'Charlotte', 'Nashville', 'Greenville', 'Princeton', 'Romulus', 'Selma', 'Paris',
  'Buffalo', 'Stanford', 'Center', 'Lake Zurich', 'Troy', 'Tijuana',
].sort((a, b) => b.length - a.length);

function clean(value) {
  return value == null ? '' : String(value).replace(/\s+/g, ' ').trim();
}

function comparisonKey(value) {
  return clean(value)
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/&/g, ' and ')
    .replace(/\b(customer|company|corporation|incorporated|corp|inc|llc|dba)\b/g, ' ')
    .replace(/\bno\.?\s*1\b|#\s*1\b|\s+1$/g, ' ')
    .replace(/[^a-z0-9:]+/g, ' ')
    .replace(/\s*:\s*/g, ':')
    .replace(/\s+/g, ' ').trim();
}

const ALIAS_GROUPS = [
  ['american venture industrial', 'avi american venture industrial', 'avi american venture industrial company', 'amereican venture avi'],
  ['donaldson', 'donaldson co', 'donaldson company'],
  ['corning', 'corning ny', 'corning shared services'],
  ['madewell homes', 'madwell homes'],
  ['toyota tmmk', 'tmmk', 'toyota motor mfg:tmmk', 'toyota motor mfg:tmmks'],
  ['versa tech automation'],
  ['bluegrass hospitality group malones', 'bhg bluegrass hospitality group malones'],
  ['big ass fans', 'big ass solutions'],
  ['city of nicholasville'],
  ['chasteen enterprises'],
  ['clark mhc'],
  ['cleco farm maintenance'],
  ['cmc environmental services', 'cmc enviornmental services'],
  ['contemporary wood designs', 'cwd contemporary wood designs', 'cwd contemporary wood design'],
  ['gooch construction'],
  ['icon automation'],
  ['j and d tool and mfg'],
  ['jessamine co school district', 'jessamine co school board of education'],
  ['k and m tool'],
  ['lockmasters technologies', 'lock tech'],
  ['lockmasters'],
  ['montgomery machine shop'],
  ['premier fabrication'],
  ['s and t fencing'],
  ['sterling tool and die', 'std sterling tool and die'],
  ['transworld tooling'],
  ['uk athletics dept', 'university of kentucky accounts payable'],
  ['walk in'],
  ['winstar', 'win star'],
  ['winstar farm'],
  ['yokohama industries americas'],
  ['preferred kustom powder coating', 'pkp powder coat', 'pkp powder'],
  ['c and r machine and fabrication', 'c and r machine shop'],
  ['sbr machinery movers', 'sbr'],
  ['t and k sealing and striping', 't and k sealing', 't and k sealing and stripping'],
];

const aliasLookup = new Map();
for (const group of ALIAS_GROUPS) {
  const canonical = comparisonKey(group[0]);
  for (const alias of group) aliasLookup.set(comparisonKey(alias), canonical);
}

function identityKey(value) {
  const base = comparisonKey(value);
  return aliasLookup.get(base) || base;
}

function extractEmails(value) {
  return [...new Set((clean(value).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []).map((email) => email.toLowerCase()))];
}

function extractEmbeddedPhone(value) {
  const matches = clean(value).match(/(?:\+?1[ .-]?)?\(?\d{3}\)?[ .-]\d{3}[ .-]\d{4}/g) || [];
  return matches[0] || null;
}

function stripKnownCompanyPrefix(billTo, names) {
  let result = clean(billTo);
  for (const name of names.filter(Boolean).sort((a, b) => b.length - a.length)) {
    const words = comparisonKey(name).split(' ').filter(Boolean);
    if (!words.length) continue;
    const firstAddressDigit = result.search(/\d/);
    const prefix = firstAddressDigit >= 0 ? result.slice(0, firstAddressDigit) : result;
    const prefixKey = comparisonKey(prefix);
    if (prefixKey === words.join(' ') || prefixKey.includes(words.join(' ')) || words.join(' ').includes(prefixKey)) {
      result = firstAddressDigit >= 0 ? result.slice(firstAddressDigit).trim() : '';
      break;
    }
  }
  return result.replace(/^[,.;:\s-]+/, '').trim();
}

function parseAddress(billTo, customerName) {
  const raw = clean(billTo);
  if (!raw || comparisonKey(raw) === comparisonKey(customerName)) return { address: null };

  const withoutEmails = raw.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, ' ').replace(/\s+/g, ' ').trim();
  let country = /\bcanada\b/i.test(withoutEmails) ? 'Canada' : /\bmexico\b/i.test(withoutEmails) ? 'Mexico' : null;
  let postalCode = null;
  let stateProvince = null;
  let city = null;

  const canadian = withoutEmails.match(/\b([A-Z]\d[A-Z])\s*(\d[A-Z]\d)\b/i);
  const us = withoutEmails.match(/\b(\d{5}(?:-\d{4})?)\b(?!.*\b\d{5}(?:-\d{4})?\b)/);
  if (canadian) {
    postalCode = `${canadian[1].toUpperCase()} ${canadian[2].toUpperCase()}`;
    country = country || 'Canada';
  } else if (us) {
    postalCode = us[1];
    country = country || 'United States';
  }

  if (postalCode) {
    const beforePostal = withoutEmails.slice(0, withoutEmails.toLowerCase().lastIndexOf(postalCode.toLowerCase())).trim();
    const regionMatch = beforePostal.match(/(?:,|\s)\s*([A-Z]{2})\.?\s*$/i);
    if (regionMatch) stateProvince = regionMatch[1].toUpperCase();
    if (!stateProvince && country === 'Canada') {
      const provinceMatch = beforePostal.match(/\b(ON|BC|AB|QC|MB|SK|NS|NB|NL|PE)\s*$/i);
      if (provinceMatch) stateProvince = provinceMatch[1].toUpperCase();
    }
    const beforeRegion = stateProvince
      ? beforePostal.slice(0, beforePostal.toLowerCase().lastIndexOf(stateProvince.toLowerCase())).replace(/[,.\s]+$/, '')
      : beforePostal;
    const cityMatch = CITY_NAMES.find((candidate) => new RegExp(`\\b${candidate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(beforeRegion));
    if (cityMatch) city = cityMatch.replace(/^Cherry Blossom Way /, '');

    if (city) {
      const cityIndex = beforeRegion.toLowerCase().lastIndexOf(city.toLowerCase());
      let street = beforeRegion.slice(0, cityIndex).replace(/[,.\s]+$/, '').trim();
      street = stripKnownCompanyPrefix(street, [customerName]);
      street = street.replace(/^(?:TMMK|TMMAL|TMMBC|TMMGT|TMMWV)\s+/i, '');
      const poBoxIndex = street.search(/\bP\s*\.?\s*O\s*\.?\s*Box\b/i);
      const streetNumberIndex = street.search(/\b\d+[A-Za-z-]*\b/);
      if (poBoxIndex > 0) street = street.slice(poBoxIndex);
      else if (streetNumberIndex > 0) street = street.slice(streetNumberIndex);
      if (street && street.length <= 300) {
        return {
          address: [street, [city, stateProvince].filter(Boolean).join(', '), postalCode, country].filter(Boolean).join('\n'),
          addressLine1: street,
          city,
          stateProvince,
          postalCode,
          country,
        };
      }
    }
  }

  const stripped = stripKnownCompanyPrefix(withoutEmails, [customerName]);
  return { address: stripped || raw, postalCode, stateProvince, country };
}

function nameFromEmail(email) {
  return email.split('@')[0].split(/[._-]+/).filter(Boolean).map((part) => part[0]?.toUpperCase() + part.slice(1)).join(' ') || email;
}

function parseWorkbook(filePath, config) {
  const workbook = XLSX.readFile(filePath, { cellDates: false });
  const sheet = workbook.Sheets.Sheet1 || workbook.Sheets[workbook.SheetNames.find((name) => name !== 'QuickBooks Desktop Export Tips')];
  if (!sheet) throw new Error(`No customer sheet found in ${filePath}`);
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: false });
  return rows.slice(4).map((row, offset) => {
    const name = clean(row[config.columns.name]);
    const billTo = clean(row[config.columns.billTo]);
    const contact = clean(row[config.columns.contact]);
    const phone = clean(row[config.columns.phone]);
    const fax = clean(row[config.columns.fax]);
    return { sourceFile: path.basename(filePath), sourceRow: offset + 5, businessCode: config.businessCode, name, billTo, contact, phone, fax };
  });
}

function locateSources(sourceDirectory) {
  const entries = fs.readdirSync(sourceDirectory).filter((file) => file.toLowerCase().endsWith('.xlsx'));
  return SOURCE_CONFIG.map((config) => {
    const file = entries.find((entry) => config.filePattern.test(entry));
    if (!file) throw new Error(`Missing ${config.businessCode} customer workbook in ${sourceDirectory}`);
    return { config, filePath: path.join(sourceDirectory, file) };
  });
}

function aggregateRows(rows) {
  const groups = new Map();
  const skipped = [];
  for (const row of rows) {
    if (!row.name || SKIP_KEYS.has(identityKey(row.name))) {
      skipped.push(row);
      continue;
    }
    const key = identityKey(row.name);
    const group = groups.get(key) || {
      key,
      preferredName: row.name.replace(/\s+#?1$/i, '').trim(),
      sourceRows: [],
      businesses: new Map(),
      contacts: [],
      addresses: [],
      phone: null,
      fax: null,
      email: null,
    };
    group.sourceRows.push(row);
    group.businesses.set(row.businessCode, row.sourceFile);
    if (!group.phone && row.phone) group.phone = row.phone;
    if (!group.fax && row.fax) group.fax = row.fax;
    const emails = extractEmails(row.billTo);
    if (!group.email && emails[0]) group.email = emails[0];
    if (row.billTo) group.addresses.push(parseAddress(row.billTo, row.name));

    if (row.contact || row.phone || row.fax || emails.length) {
      const contactEmails = emails.length ? emails : [null];
      for (const [emailIndex, email] of contactEmails.entries()) {
        const name = emailIndex === 0 && row.contact ? row.contact : email ? nameFromEmail(email) : row.contact || 'General office';
        const contactCandidate = {
          name,
          title: /account(?:s)? payable|\ba\/?p\b/i.test(name) ? 'Accounts Payable' : null,
          phone: emailIndex === 0 ? row.phone || extractEmbeddedPhone(row.billTo) : null,
          fax: emailIndex === 0 ? row.fax || null : null,
          email,
        };
        const contactKey = contactCandidate.email
          ? `email:${contactCandidate.email}`
          : `name:${comparisonKey(contactCandidate.name)}|phone:${comparisonKey(contactCandidate.phone || '')}`;
        if (!group.contacts.some((existing) => existing.key === contactKey)) group.contacts.push({ key: contactKey, ...contactCandidate });
      }
    }
    groups.set(key, group);
  }

  for (const group of groups.values()) {
    group.address = group.addresses.find((value) => value.addressLine1) || group.addresses.find((value) => value.address) || { address: null };
  }
  return { groups: [...groups.values()], skipped };
}

function present(value) {
  return value != null && String(value).trim() !== '';
}

function sameContact(existing, candidate) {
  if (candidate.email && existing.email && candidate.email.toLowerCase() === existing.email.toLowerCase()) return true;
  return comparisonKey(existing.name) === comparisonKey(candidate.name)
    && (!candidate.phone || !existing.phone || comparisonKey(candidate.phone) === comparisonKey(existing.phone));
}

async function buildPlan(prisma, groups) {
  const existing = await prisma.customer.findMany({ include: { contacts: true, businesses: true } });
  const existingByKey = new Map(existing.map((customer) => [identityKey(customer.name), customer]));
  const plan = [];
  for (const group of groups) {
    const customer = existingByKey.get(group.key) || null;
    const address = customer?.address ? parseAddress(customer.address, customer.name) : group.address;
    const createContacts = group.contacts.map(({ key: _key, ...contact }, index) => ({ ...contact, isPrimary: index === 0, sortOrder: index }));
    if (!customer) {
      plan.push({ action: 'create', group, data: {
        name: group.preferredName,
        contact: createContacts[0]?.name || null,
        phone: createContacts[0]?.phone || group.phone,
        fax: createContacts[0]?.fax || group.fax,
        email: createContacts[0]?.email || group.email,
        address: address.address || null,
        addressLine1: address.addressLine1 || null,
        city: address.city || null,
        stateProvince: address.stateProvince || null,
        postalCode: address.postalCode || null,
        country: address.country || null,
        contacts: createContacts,
      } });
      continue;
    }

    const updates = {};
    for (const field of ['phone', 'fax', 'email']) if (!present(customer[field]) && present(group[field])) updates[field] = group[field];
    for (const field of ['address', 'addressLine1', 'city', 'stateProvince', 'postalCode', 'country']) {
      if (!present(customer[field]) && present(address[field])) updates[field] = address[field];
    }
    const newContacts = createContacts.filter((candidate) => !customer.contacts.some((contact) => sameContact(contact, candidate)));
    const newBusinesses = [...group.businesses.keys()].filter((code) => !customer.businesses.some((membership) => membership.businessCode === code));
    plan.push({ action: 'merge', group, customer, updates, newContacts, newBusinesses });
  }
  return { plan, existingCount: existing.length };
}

async function applyPlan(prisma, plan) {
  return prisma.$transaction(async (tx) => {
    for (const item of plan) {
      if (item.action === 'create') {
        const created = await tx.customer.create({
          data: {
            ...item.data,
            contacts: item.data.contacts.length ? { create: item.data.contacts } : undefined,
            businesses: { create: [...item.group.businesses].map(([businessCode, sourceFile]) => ({ businessCode, sourceFile })) },
          },
        });
        item.appliedCustomerId = created.id;
      } else {
        await tx.customer.update({
          where: { id: item.customer.id },
          data: {
            ...item.updates,
            contacts: item.newContacts.length ? {
              create: item.newContacts.map((contact, index) => ({ ...contact, isPrimary: false, sortOrder: item.customer.contacts.length + index })),
            } : undefined,
            businesses: item.newBusinesses.length ? {
              create: item.newBusinesses.map((businessCode) => ({ businessCode, sourceFile: item.group.businesses.get(businessCode) })),
            } : undefined,
          },
        });
      }
    }
  });
}

function reportFor(plan, skipped, existingCount, sourceRows) {
  const creates = plan.filter((item) => item.action === 'create');
  const merges = plan.filter((item) => item.action === 'merge');
  return {
    sourceRows,
    skippedRows: skipped.map((row) => ({ business: row.businessCode, row: row.sourceRow, name: row.name })),
    uniqueImportedCustomers: plan.length,
    productionCustomersBefore: existingCount,
    customersToCreate: creates.length,
    existingCustomersMatched: merges.length,
    existingCustomersWithFieldsToFill: merges.filter((item) => Object.keys(item.updates).length).length,
    contactsToCreate: plan.reduce((sum, item) => sum + (item.action === 'create' ? item.data.contacts.length : item.newContacts.length), 0),
    businessMembershipsToCreate: plan.reduce((sum, item) => sum + (item.action === 'create' ? item.group.businesses.size : item.newBusinesses.length), 0),
    matchedExisting: merges.map((item) => ({ imported: item.group.preferredName, existing: item.customer.name, fieldsFilled: Object.keys(item.updates), contactsAdded: item.newContacts.length, businessesAdded: item.newBusinesses })),
    multiBusinessCustomers: plan.filter((item) => item.group.businesses.size > 1).map((item) => ({ name: item.group.preferredName, businesses: [...item.group.businesses.keys()] })),
  };
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const sourceFlag = args.indexOf('--source-dir');
  const reportFlag = args.indexOf('--report');
  const sourceDirectory = path.resolve(sourceFlag >= 0 ? args[sourceFlag + 1] : '.');
  const reportPath = path.resolve(reportFlag >= 0 ? args[reportFlag + 1] : 'customer-import-report.json');
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');

  const sources = locateSources(sourceDirectory);
  const rows = sources.flatMap(({ config, filePath }) => parseWorkbook(filePath, config));
  const { groups, skipped } = aggregateRows(rows);
  const prisma = new PrismaClient();
  try {
    const { plan, existingCount } = await buildPlan(prisma, groups);
    const report = reportFor(plan, skipped, existingCount, rows.length);
    report.mode = apply ? 'apply' : 'dry-run';
    report.generatedAt = new Date().toISOString();
    if (apply) await applyPlan(prisma, plan);
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify(report, null, 2));
    console.log(`\n${apply ? 'Import applied' : 'Dry run complete'}. Report: ${reportPath}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
