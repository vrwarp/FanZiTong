/** One-off notices the dashboard shows once, dismissed per device (not part of a backup). */
export const REPAIR_NOTICE_KEY = 'fzt-repair-notice-dismissed';

/** Whether the schedule-repair notice for the repair run at `at` was dismissed. */
export function readRepairNoticeDismissed(at: string): boolean {
  try {
    return localStorage.getItem(REPAIR_NOTICE_KEY) === at;
  } catch {
    return false;
  }
}

export function dismissRepairNotice(at: string): void {
  try {
    localStorage.setItem(REPAIR_NOTICE_KEY, at);
  } catch {
    /* ignore */
  }
}
