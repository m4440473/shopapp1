export function isPartReadyForDepartment(
  part: {
    currentDepartmentId?: string | null;
    checklistItems?: Array<{
      departmentId?: string | null;
      isActive?: boolean | null;
      completed?: boolean | null;
    }>;
  },
  departmentId: string,
) {
  if (!departmentId) return false;
  if (part.currentDepartmentId !== departmentId) return false;
  const checklist = part.checklistItems ?? [];
  return checklist.some(
    (item) =>
      item.departmentId === departmentId && item.isActive !== false && item.completed === false,
  );
}
