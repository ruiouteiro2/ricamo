/** Calendar days are local civil dates; event timestamps remain UTC instants. */
export function localDate(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.valueOf())) throw new RangeError('invalid_date');
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function displayDate(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T12:00:00`);
    return !Number.isNaN(date.valueOf()) && localDate(date) === value ? date : new Date(NaN);
  }
  return new Date(value);
}
