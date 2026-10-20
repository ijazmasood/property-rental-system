export function formatCurrency(value, config = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError('A finite numeric amount is required.');
  }

  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: config.currency || 'GBP'
  }).format(value);
}
