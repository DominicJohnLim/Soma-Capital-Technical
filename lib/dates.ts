// Due dates are stored as UTC midnight (from the <input type="date"> value),
// so compare the due date's UTC calendar day against the user's local calendar
// day. Date-only comparison: a task due today is not overdue.
export function isOverdue(
  dueDate: string | Date | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!dueDate) return false;
  const due = new Date(dueDate);
  if (isNaN(due.getTime())) return false;
  const dueKey = Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate());
  const todayKey = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return dueKey < todayKey;
}

export function formatDate(d: string | Date): string {
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
