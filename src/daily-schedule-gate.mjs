/**
 * GitHub Actions schedules are UTC cron expressions.  These two expressions
 * are the only candidates for the Hoogvliet 06:00 Europe/Amsterdam run:
 * 04:00 UTC during CEST and 05:00 UTC during CET.
 *
 * The gate compares the schedule's DST offset, rather than the runner's
 * current wall clock hour.  GitHub can start scheduled runs late; a delayed
 * valid event must still be allowed, while the other daily candidate must be
 * skipped.  The persistent daily claim remains the final duplicate guard.
 */

export const DAILY_SCHEDULE_OFFSETS = Object.freeze({
  '0 4 * * *': 120,
  '0 5 * * *': 60,
});

const AMSTERDAM_TIME_ZONE = 'Europe/Amsterdam';

function localParts(instant) {
  const date = instant instanceof Date ? instant : new Date(instant);
  if (Number.isNaN(date.getTime())) throw new Error('Invalid schedule instant');

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: AMSTERDAM_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'longOffset',
    hourCycle: 'h23',
  }).formatToParts(date);
  const values = Object.fromEntries(parts
    .filter(({ type }) => type !== 'literal')
    .map(({ type, value }) => [type, value]));
  const offset = /^GMT([+-])(\d{2}):(\d{2})$/.exec(values.timeZoneName ?? '');
  if (!offset) throw new Error(`Unexpected Amsterdam timezone offset: ${values.timeZoneName ?? 'missing'}`);

  const offsetMinutes = (Number(offset[2]) * 60 + Number(offset[3])) * (offset[1] === '+' ? 1 : -1);
  return { hour: values.hour, minute: values.minute, offsetMinutes };
}

export function evaluateDailySchedule({ schedule, instant = new Date() }) {
  const expectedOffsetMinutes = DAILY_SCHEDULE_OFFSETS[schedule];
  if (expectedOffsetMinutes === undefined) {
    return { isDailyTrigger: false, shouldRun: false, reason: 'not-daily-schedule' };
  }

  const local = localParts(instant);
  const shouldRun = local.offsetMinutes === expectedOffsetMinutes;
  return {
    isDailyTrigger: true,
    shouldRun,
    reason: shouldRun ? 'correct-dst-trigger' : 'other-dst-trigger',
    localHour: local.hour,
    localMinute: local.minute,
    localOffsetMinutes: local.offsetMinutes,
    expectedOffsetMinutes,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const schedule = process.env.SCHEDULE_CRON;
  if (!schedule) throw new Error('SCHEDULE_CRON is required');
  const result = evaluateDailySchedule({
    schedule,
    instant: process.env.SCHEDULE_NOW_UTC ? new Date(process.env.SCHEDULE_NOW_UTC) : new Date(),
  });
  if (!result.isDailyTrigger) throw new Error(`Unknown daily schedule: ${schedule}`);
  console.log(`run=${result.shouldRun ? '1' : '0'}`);
  console.log(`reason=${result.reason}`);
  console.log(`local_time=${result.localHour}:${result.localMinute}`);
  console.log(`local_offset_minutes=${result.localOffsetMinutes}`);
}
