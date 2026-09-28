/**
 * Schedule & Timing Constants for Web Frontend
 * Sourced from institutional standard definitions in constants/demoData.js
 */

export const WEEK_DAYS = [
  { id: 'MON', label: 'Mon', full: 'Monday' },
  { id: 'TUE', label: 'Tue', full: 'Tuesday' },
  { id: 'WED', label: 'Wed', full: 'Wednesday' },
  { id: 'THU', label: 'Thu', full: 'Thursday' },
  { id: 'FRI', label: 'Fri', full: 'Friday' },
];

export const PERIOD_TIMINGS = [
  { period: 'P1', startTime: '09:15', endTime: '10:05', label: '09:15 – 10:05' },
  { period: 'P2', startTime: '10:05', endTime: '10:55', label: '10:05 – 10:55' },
  { type: 'break', name: 'Morning Break', duration: '15m', startTime: '10:55', endTime: '11:10', icon: '☕' },
  { period: 'P3', startTime: '11:10', endTime: '12:00', label: '11:10 – 12:00' },
  { period: 'P4', startTime: '12:00', endTime: '12:50', label: '12:00 – 12:50' },
  { type: 'lunch', name: 'Lunch Interval', duration: '55m', startTime: '12:50', endTime: '01:45', icon: '🍽️' },
  { period: 'P5', startTime: '01:45', endTime: '02:35', label: '01:45 – 02:35' },
  { period: 'P6', startTime: '02:35', endTime: '03:25', label: '02:35 – 03:25' },
  { type: 'break', name: 'Evening Break', duration: '15m', startTime: '03:25', endTime: '03:40', icon: '🍵' },
  { period: 'P7', startTime: '03:40', endTime: '04:30', label: '03:40 – 04:30' },
];

export const TIMETABLE_STATUSES = {
  NO_TIMETABLE: 'NO_TIMETABLE',
  DRAFT: 'DRAFT',
  GENERATED: 'GENERATED',
  PENDING_HOD_APPROVAL: 'PENDING_HOD_APPROVAL',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  PUBLISHED: 'PUBLISHED',
};

export const COURSE_ALLOCATION_RULES = {
  SINGLE_FACULTY: 'SINGLE_FACULTY',
  PRIMARY_PLUS_ADDITIONAL: 'PRIMARY_PLUS_ADDITIONAL',
  MINIMUM_TWO: 'MINIMUM_TWO',
  STAFFS_HANDLED: 'STAFFS_HANDLED',
};
