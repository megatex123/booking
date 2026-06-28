import { BookingStatus } from '../types';

export const formatPrice = (price: number): string =>
  `RM ${price.toFixed(2)}`;

export const formatDate = (dateStr: string): string => {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-MY', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
};

export const formatTime = (timeStr: string): string => {
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, '0')} ${period}`;
};

export const formatDateTime = (dateStr: string): string => {
  const d = new Date(dateStr);
  return d.toLocaleString('en-MY', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export const getStatusLabel = (status: BookingStatus): string => {
  const labels: Record<BookingStatus, string> = {
    pending: 'Pending',
    confirmed: 'Confirmed',
    rejected: 'Rejected',
    in_progress: 'In Progress',
    completed: 'Completed',
    cancelled: 'Cancelled',
  };
  return labels[status] || status;
};

export const getCategoryLabel = (cat: string): string => {
  const labels: Record<string, string> = {
    oil_change: 'Oil Change',
    tire: 'Tire',
    brake: 'Brake',
    engine: 'Engine',
    body: 'Body Work',
    electrical: 'Electrical',
    other: 'Other',
  };
  return labels[cat] || cat;
};

export const generateTimeSlots = (): string[] => {
  const slots: string[] = [];
  for (let h = 8; h < 18; h++) {
    slots.push(`${h.toString().padStart(2, '0')}:00`);
    if (h < 17) slots.push(`${h.toString().padStart(2, '0')}:30`);
  }
  return slots;
};

export const getAvailableDates = (days = 14): string[] => {
  const dates: string[] = [];
  const today = new Date();
  for (let i = 1; i <= days; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
};
