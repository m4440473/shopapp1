import { describe, expect, it } from 'vitest';

import {
  getActiveQuoteDepartments,
  getNewQuoteOriginDepartmentId,
} from '../quote-departments';

const departments = [
  { id: 'paint', name: 'Paint', isActive: true, sortOrder: 20 },
  { id: 'fab-z', name: 'Fab Z', isActive: true, sortOrder: 10 },
  { id: 'inactive', name: 'Assembly', isActive: false, sortOrder: -10 },
  { id: 'fab-a', name: 'Fab A', isActive: true, sortOrder: 10 },
];

describe('quote department defaults', () => {
  it('orders active departments by sort order and then name', () => {
    expect(getActiveQuoteDepartments(departments).map((department) => department.id)).toEqual([
      'fab-a',
      'fab-z',
      'paint',
    ]);
  });

  it('selects the actual first active department for a new quote', () => {
    expect(getNewQuoteOriginDepartmentId('', departments)).toBe('fab-a');
  });

  it('preserves an explicit selection after departments load or reorder', () => {
    expect(getNewQuoteOriginDepartmentId('paint', departments)).toBe('paint');
  });

  it('replaces an inactive selection with the first active department on create', () => {
    expect(getNewQuoteOriginDepartmentId('inactive', departments)).toBe('fab-a');
  });

  it('does not select an inactive department when no active department exists', () => {
    expect(getNewQuoteOriginDepartmentId('', [departments[2]])).toBe('');
  });
});
