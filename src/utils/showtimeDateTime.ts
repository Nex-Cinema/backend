/**
 * Combines Prisma/MySQL DATE and TIME values without applying the host timezone.
 * MySQL TIME is represented by Prisma as a 1970 Date, so only its UTC clock
 * fields are meaningful.
 */
export const combineShowtimeDateTime = (dateValue: Date, timeValue: Date): Date =>
  new Date(Date.UTC(
    dateValue.getUTCFullYear(),
    dateValue.getUTCMonth(),
    dateValue.getUTCDate(),
    timeValue.getUTCHours(),
    timeValue.getUTCMinutes(),
    timeValue.getUTCSeconds(),
    timeValue.getUTCMilliseconds(),
  ));
