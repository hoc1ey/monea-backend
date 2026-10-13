export const FIREBASE_APP = 'FIREBASE_APP';

export enum DevicePlatform {
  ANDROID = 'ANDROID',
}

export enum ReminderType {
  CREDIT_CARD_PAYMENT = 'CREDIT_CARD_PAYMENT',
  RECURRING_EXPENSE = 'RECURRING_EXPENSE',
  COLLECTION = 'COLLECTION',
  LOAN = 'LOAN',
  DEBT = 'DEBT',
}

export enum ReminderStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}
