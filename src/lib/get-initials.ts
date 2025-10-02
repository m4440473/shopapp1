export function getInitials(value?: string | null) {
  if (!value) return 'SA';
  const parts = value.split(' ').filter(Boolean);
  if (!parts.length) return value.slice(0, 2).toUpperCase();
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}
