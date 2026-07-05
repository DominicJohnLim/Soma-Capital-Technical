// A per-task mini-Gantt bar positioned across the whole project span.
// Critical tasks (zero slack) tile the timeline end-to-end in amber; others
// show a solid bar plus a hatched slack extension they could slip into.
export function ScheduleRail({
  startDay,
  durationDays,
  slackDays,
  totalDays,
  isCritical,
  showLabel = true,
}: {
  startDay: number;
  durationDays: number;
  slackDays: number;
  totalDays: number;
  isCritical: boolean;
  showLabel?: boolean;
}) {
  const total = Math.max(totalDays, 1);
  const pct = (n: number) => `${(n / total) * 100}%`;
  // One gridline per day.
  const grid = {
    backgroundImage: 'linear-gradient(to right, #ece9e6 1px, transparent 1px)',
    backgroundSize: `${100 / total}% 100%`,
  };

  return (
    <div>
      <div className="relative h-2.5 rounded-[3px]" style={grid}>
        <div
          className="absolute top-px bottom-px rounded-[3px]"
          style={{
            left: pct(startDay),
            width: pct(durationDays),
            background: isCritical ? '#f59e0b' : '#d6d3d1',
          }}
        />
        {slackDays > 0 && (
          <div
            className="absolute top-px bottom-px rounded-[3px]"
            style={{
              left: pct(startDay + durationDays),
              width: pct(slackDays),
              background: 'repeating-linear-gradient(45deg, #ece9e6 0 3px, transparent 3px 6px)',
            }}
          />
        )}
      </div>
      {showLabel && (
        <div
          className={`font-mono text-[9px] mt-1 text-right ${
            isCritical ? 'text-amber-700' : 'text-stone-400'
          }`}
        >
          slack {slackDays}d
        </div>
      )}
    </div>
  );
}

export default ScheduleRail;
