export type Page =
  | 'home'
  | 'topup-ml'
  | 'topup-starlight'
  | 'accounts-customers'
  | 'accounts-store'
  | 'admin';

export type OrderStatus = 'pending' | 'completed' | 'delayed';

export const SUPPORT_NUMBER = '01000000000';
export const SUPPORT_LINK = `https://wa.me/2${SUPPORT_NUMBER}`;

export const ORDER_ID_KEY = 'gamer-store-order-id';

export const formatEGP = (price: number) => `${price.toLocaleString('en-US')} جنيه`;

export const formatPrice = (price: number) => price.toLocaleString('en-US');

export function timeSince(dateIso: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateIso).getTime()) / 1000);
  if (seconds < 60) return 'قبل لحظات';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `منذ ${minutes} دقيقة`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `منذ ${hours} ساعة`;
  const days = Math.floor(hours / 24);
  return `منذ ${days} يوم`;
}

export function minutesSince(dateIso: string): number {
  return Math.floor((Date.now() - new Date(dateIso).getTime()) / 60000);
}
