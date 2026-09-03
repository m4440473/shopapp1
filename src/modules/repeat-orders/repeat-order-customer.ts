// A wizard step can remount before Select options arrive. Empty select events
// must not erase the source customer; an explicit selection still wins.
export function resolveRepeatOrderCustomer(selectedId?: string | null, templateId?: string | null) {
  return selectedId?.trim() || templateId?.trim() || '';
}
