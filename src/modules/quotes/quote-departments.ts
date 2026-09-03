export type QuoteDepartmentOption = {
  id: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
};

export function getActiveQuoteDepartments(departments: QuoteDepartmentOption[]) {
  return departments
    .filter((department) => department.isActive)
    .sort((left, right) =>
      left.sortOrder - right.sortOrder ||
      left.name.localeCompare(right.name) ||
      left.id.localeCompare(right.id)
    );
}

export function getNewQuoteOriginDepartmentId(
  currentDepartmentId: string,
  departments: QuoteDepartmentOption[]
) {
  const activeDepartments = getActiveQuoteDepartments(departments);
  if (activeDepartments.some((department) => department.id === currentDepartmentId)) {
    return currentDepartmentId;
  }
  return activeDepartments[0]?.id || '';
}
