import { daysBetween, getDemoToday } from './date.js';

function requiredDate(value, fieldName) {
  if (typeof value !== 'string' || !value) {
    throw new TypeError(`${fieldName} is required for status calculations.`);
  }
  return value;
}

export function getDocumentStatus(document, config) {
  const expiryDate = requiredDate(document?.expiryDate, 'document.expiryDate');
  const daysUntilExpiry = daysBetween(getDemoToday(config), expiryDate);

  if (daysUntilExpiry < 0) return 'expired';
  const reminderDays = config.reminderDays || [];
  const reminderWindow = Math.max(0, ...reminderDays);
  return daysUntilExpiry <= reminderWindow ? 'expiring' : 'valid';
}

export function getRentStatus(rent, config) {
  const amount = Number(rent?.amount);
  const paidAmount = Number(rent?.paidAmount || 0);
  if (!Number.isFinite(amount) || amount < 0 || !Number.isFinite(paidAmount) || paidAmount < 0) {
    throw new TypeError('Rent amount and paidAmount must be valid non-negative numbers.');
  }
  if (rent.status === 'paid' || (amount > 0 && paidAmount >= amount)) return 'paid';
  if (paidAmount > 0) return 'partial';

  const dueDate = requiredDate(rent?.dueDate, 'rent.dueDate');
  return daysBetween(getDemoToday(config), dueDate) < 0 ? 'overdue' : 'upcoming';
}

export function getBillStatus(bill, config) {
  if (bill.status === 'paid') return 'paid';
  const dueDate = requiredDate(bill?.dueDate, 'bill.dueDate');
  return daysBetween(getDemoToday(config), dueDate) < 0 ? 'overdue' : 'unpaid';
}
