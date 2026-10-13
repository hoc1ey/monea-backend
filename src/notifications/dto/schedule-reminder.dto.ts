import { ReminderType } from '../notifications.constants.js';

export interface ScheduleReminderInput {
  userId: string;
  type: ReminderType;
  sourceId: string;
  title: string;
  body: string;
  scheduledAt: Date;
}
