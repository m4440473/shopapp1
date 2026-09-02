import { beforeEach, describe, expect, it, vi } from 'vitest';

const findCustomerContactById = vi.fn();

vi.mock('../customers.repo', () => ({
  createCustomer: vi.fn(),
  updateCustomer: vi.fn(),
  listCustomers: vi.fn(),
  listCustomersWithOrders: vi.fn(),
  findCustomerDetailById: vi.fn(),
  findCustomerContactById,
}));

describe('customers.service', () => {
  beforeEach(() => {
    findCustomerContactById.mockReset();
  });

  it('adapts legacy contact fields into one primary normalized contact', async () => {
    const { buildCustomerCreateData } = await import('../customers.service');

    expect(buildCustomerCreateData({
      name: 'Toyota',
      contact: '  Alex Buyer  ',
      email: 'alex@example.com',
      phone: ' 555-0100 ',
    })).toMatchObject({
      name: 'Toyota',
      contact: 'Alex Buyer',
      email: 'alex@example.com',
      phone: '555-0100',
      contacts: [{
        name: 'Alex Buyer',
        email: 'alex@example.com',
        phone: '555-0100',
        isPrimary: true,
        sortOrder: 0,
      }],
    });
  });

  it('keeps exactly one primary contact while preserving contact order', async () => {
    const { normalizeCustomerContacts } = await import('../customers.service');

    const contacts = normalizeCustomerContacts([
      { name: 'First', isPrimary: true },
      { name: 'Second', isPrimary: true },
      { name: 'Third' },
    ]);

    expect(contacts?.map((contact) => ({ name: contact.name, isPrimary: contact.isPrimary, sortOrder: contact.sortOrder }))).toEqual([
      { name: 'First', isPrimary: true, sortOrder: 0 },
      { name: 'Second', isPrimary: false, sortOrder: 1 },
      { name: 'Third', isPrimary: false, sortOrder: 2 },
    ]);
  });

  it('formats a structured shipping address and falls back to legacy text', async () => {
    const { formatCustomerShippingAddress } = await import('../customers.service');

    expect(formatCustomerShippingAddress({
      addressLine1: '123 Main St',
      addressLine2: 'Dock 4',
      city: 'Lexington',
      stateProvince: 'KY',
      postalCode: '40502',
      country: 'USA',
    })).toBe('123 Main St\nDock 4\nLexington, KY 40502\nUSA');
    expect(formatCustomerShippingAddress({ address: 'Legacy address block' })).toBe('Legacy address block');
  });

  it('dual-writes the primary contact and formatted legacy address', async () => {
    const { buildCustomerCreateData } = await import('../customers.service');

    const data = buildCustomerCreateData({
      name: 'Toyota',
      contacts: [
        { name: 'Engineer', email: 'engineer@example.com' },
        { name: 'Buyer', phone: '555-0123', isPrimary: true },
      ],
      addressLine1: '1 Toyota Way',
      city: 'Georgetown',
      stateProvince: 'KY',
      postalCode: '40324',
    });

    expect(data).toMatchObject({
      contact: 'Buyer',
      phone: '555-0123',
      email: null,
      address: '1 Toyota Way\nGeorgetown, KY 40324',
    });
  });

  it('rejects a contact that belongs to a different customer', async () => {
    const { resolveCustomerContactSnapshot } = await import('../customers.service');
    findCustomerContactById.mockResolvedValue({
      id: 'contact-1',
      customerId: 'customer-2',
      name: 'Wrong Customer',
      email: null,
      phone: null,
    });

    await expect(resolveCustomerContactSnapshot('customer-1', 'contact-1')).rejects.toThrow(
      'does not belong to this customer',
    );
  });
});
