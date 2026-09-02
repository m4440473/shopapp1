import { describe, expect, it } from 'vitest';

import { buildOrderTraveler } from '../order-traveler';

describe('buildOrderTraveler', () => {
  it('builds a part-centric traveler with ordered active routing steps', () => {
    const traveler = buildOrderTraveler({
      id: 'order-1',
      orderNumber: '250825-001',
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      customer: { name: 'Acme', contact: 'Sam' },
      assignedMachinist: { name: 'Pat' },
      parts: [
        {
          id: 'part-1',
          partNumber: 'P-100',
          partName: 'Mount',
          quantity: 4,
          currentDepartmentId: 'fab',
          material: { name: 'A36', spec: 'ASTM A36' },
          stockSize: '0.25 × 2.5 × 16.5',
          cutLength: '4.125',
          partWidth: '2.5',
          partThickness: '0.25',
          workInstructions: 'Verify the print revision before cutting.',
          attachments: [{ id: 'print', label: 'P-100 Rev B.pdf', url: '/api/files/print' }],
          assignments: [{ user: { name: 'Alex' } }],
        },
      ],
      checklist: [
        {
          id: 'paint',
          partId: 'part-1',
          departmentId: 'paint',
          completed: false,
          isActive: true,
          department: { name: 'Paint', sortOrder: 20 },
          addon: { name: 'Powder coat' },
        },
        {
          id: 'fab',
          partId: 'part-1',
          departmentId: 'fab',
          completed: true,
          isActive: true,
          department: { name: 'Fab', sortOrder: 10 },
          charge: { name: 'Weld' },
        },
        {
          id: 'inactive',
          partId: 'part-1',
          isActive: false,
          addon: { name: 'Ignore me' },
        },
      ],
    });

    expect(traveler.coordinator).toBe('Pat');
    expect(traveler.parts[0]).toMatchObject({
      partNumber: 'P-100',
      currentDepartment: 'Fab',
      material: 'A36 — ASTM A36',
      requiredReading: 'Verify the print revision before cutting.',
      assignedWorkers: ['Alex'],
    });
    expect(traveler.parts[0].steps).toEqual([
      { id: 'fab', department: 'Fab', label: 'Weld', completed: true },
      { id: 'paint', department: 'Paint', label: 'Powder coat', completed: false },
    ]);
    expect(traveler.parts[0].specifications).toEqual(expect.arrayContaining([
      { label: 'Total stock dimensions', value: '0.25 × 2.5 × 16.5' },
      { label: 'Finished thickness', value: '0.25' },
      { label: 'Finished width', value: '2.5' },
      { label: 'Cut length', value: '4.125' },
    ]));
    expect(traveler.parts[0].files[0]).toMatchObject({
      label: 'P-100 Rev B.pdf',
      href: '/api/files/print',
    });
  });

  it('does not turn storage paths or unsafe URLs into printable links', () => {
    const traveler = buildOrderTraveler({
      id: 'order-1',
      orderNumber: '1',
      customer: { name: 'Acme' },
      attachments: [{ id: 'a', storagePath: 'C:\\ShopApp\\storage\\drawing.pdf' }],
      parts: [
        {
          id: 'part-1',
          partNumber: 'P-1',
          attachments: [{ id: 'b', label: 'Bad link', url: 'javascript:alert(1)' }],
        },
      ],
    });

    expect(traveler.orderFiles[0]).toEqual({
      id: 'a',
      label: 'drawing.pdf',
      kind: null,
      href: null,
    });
    expect(traveler.parts[0].files[0].href).toBeNull();
  });

  it('keeps the coordinator separate from assigned workers and prefers the saved order contact snapshot', () => {
    const traveler = buildOrderTraveler({
      id: 'order-2',
      orderNumber: 'STD-2000',
      contactName: 'Toyota Buyer',
      contactEmail: 'buyer@toyota.example',
      contactPhone: '555-0102',
      customer: {
        name: 'Toyota',
        contact: 'Changed Primary Contact',
        email: 'changed@example.com',
        addressLine1: '1 Toyota Way',
        city: 'Georgetown',
        stateProvince: 'KY',
        postalCode: '40324',
      },
      assignedMachinist: null,
      parts: [{
        id: 'part-2',
        partNumber: 'P-2',
        assignments: [
          { isActive: true, user: { name: 'Alex' } },
          { isActive: true, user: { name: 'Jamie' } },
          { isActive: false, user: { name: 'Former worker' } },
        ],
      }],
    });

    expect(traveler.coordinator).toBe('Unassigned');
    expect(traveler.parts[0].assignedWorkers).toEqual(['Alex', 'Jamie']);
    expect(traveler.customer).toMatchObject({
      contact: 'Toyota Buyer',
      email: 'buyer@toyota.example',
      phone: '555-0102',
      address: '1 Toyota Way\nGeorgetown, KY 40324',
    });
  });
});
