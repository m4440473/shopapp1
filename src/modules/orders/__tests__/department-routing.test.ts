import { describe, expect, it } from 'vitest';

import { findNextDepartmentWithOpenChecklist, isPartReadyForDepartment } from '../department-routing';

describe('isPartReadyForDepartment', () => {
  it('returns false when the part is not in the department', () => {
    const part = {
      currentDepartmentId: 'dept-1',
      checklistItems: [{ departmentId: 'dept-2', isActive: true, completed: false }],
    };

    expect(isPartReadyForDepartment(part, 'dept-2')).toBe(false);
  });

  it('returns false when there are no active checklist items', () => {
    const part = {
      currentDepartmentId: 'dept-1',
      checklistItems: [{ departmentId: 'dept-1', isActive: false, completed: false }],
    };

    expect(isPartReadyForDepartment(part, 'dept-1')).toBe(false);
  });

  it('returns false when all department items are completed', () => {
    const part = {
      currentDepartmentId: 'dept-1',
      checklistItems: [
        { departmentId: 'dept-1', isActive: true, completed: true },
        { departmentId: 'dept-1', isActive: true, completed: true },
      ],
    };

    expect(isPartReadyForDepartment(part, 'dept-1')).toBe(false);
  });

  it('returns true when an active incomplete checklist item exists', () => {
    const part = {
      currentDepartmentId: 'dept-1',
      checklistItems: [
        { departmentId: 'dept-1', isActive: true, completed: true },
        { departmentId: 'dept-1', isActive: true, completed: false },
      ],
    };

    expect(isPartReadyForDepartment(part, 'dept-1')).toBe(true);
  });
});

describe('findNextDepartmentWithOpenChecklist', () => {
  const departments = [{ id: 'machining' }, { id: 'fab' }, { id: 'paint' }];

  it('uses department order while skipping departments without open work', () => {
    const checklist = [
      { departmentId: 'machining', isActive: true, completed: true },
      { departmentId: 'fab', isActive: true, completed: true },
      { departmentId: 'paint', isActive: true, completed: false },
    ];

    expect(findNextDepartmentWithOpenChecklist(checklist, departments)).toBe('paint');
  });

  it('ignores inactive and completed checklist items', () => {
    const checklist = [
      { departmentId: 'machining', isActive: false, completed: false },
      { departmentId: 'fab', isActive: true, completed: true },
    ];

    expect(findNextDepartmentWithOpenChecklist(checklist, departments)).toBeNull();
  });

  it('does not assume the next global department has work', () => {
    const checklist = [
      { departmentId: 'machining', isActive: true, completed: true },
      { departmentId: 'paint', isActive: true, completed: false },
    ];

    expect(findNextDepartmentWithOpenChecklist(checklist, departments)).toBe('paint');
  });
});
