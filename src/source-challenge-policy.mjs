// Minimum cooldowns, not a promise of source access. Never solve a challenge.
export const SOURCE_CHALLENGE_BACKOFF_MINUTES = Object.freeze([15, 30, 60]);

export function sourceChallengeRetryAt(challengeNumber, completedAt) {
  const minutes = SOURCE_CHALLENGE_BACKOFF_MINUTES[challengeNumber - 1];
  if (!minutes || !Number.isFinite(Date.parse(completedAt))) return null;
  return new Date(Date.parse(completedAt) + minutes * 60_000);
}

export function challengeRecoveryDecision(job, attempts, now) {
  const latest = attempts.at(-1);
  const count = attempts.filter(row => row.error_code === 'source_challenge').length;
  const retryAt = sourceChallengeRetryAt(count, latest?.completed_at);
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).map(({ type, value }) => [type, value]));
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  if (job?.jobDate !== date || +parts.hour < 6 || +parts.hour >= 23) return { allowed: false, reason: 'outside_daily_window' };
  if (!job.updatedAt || job.targetNewProducts !== 400 || job.remainingTarget < 1
      || job.lockExpiresAt || job.status !== 'daily_target_partial'
      || latest?.error_code !== 'source_challenge' || latest.status !== 'daily_target_partial'
      || latest.attempt_number !== job.attemptCount || attempts.length !== job.attemptCount
      || latest.cumulative_new_after !== job.newProductsCollected
      || latest.remaining_target_after !== job.remainingTarget) {
    return { allowed: false, reason: 'challenge_recovery_not_proven' };
  }
  if (!retryAt) return { allowed: false, reason: 'source_challenge_retry_limit' };
  if (now < retryAt) return { allowed: false, reason: 'retry_not_due', retryAt };
  return { allowed: true, retryAt, challenges: count };
}
