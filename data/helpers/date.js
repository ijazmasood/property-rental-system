function dateOnly(value) {
  if (value instanceof Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  if (typeof value !== 'string' || !value) {
    throw new TypeError('A date value is required.');
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) {
    throw new TypeError(`Expected an ISO date, received "${value}".`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day);
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) {
    throw new RangeError(`Invalid calendar date: "${value}".`);
  }

  return parsed;
}

export function getDemoToday(config) {
  if (!config || typeof config.demoToday !== 'string') {
    throw new TypeError('config.demoToday is required for demo-date calculations.');
  }
  return dateOnly(config.demoToday);
}

export function parseISODate(value) {
  return dateOnly(value);
}

export function daysBetween(start, end) {
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  return Math.round((dateOnly(end).getTime() - dateOnly(start).getTime()) / millisecondsPerDay);
}

export function formatDate(value, options = {}) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...options
  }).format(dateOnly(value));
}
