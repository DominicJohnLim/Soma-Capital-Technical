"use client"
import { useState, useEffect, useCallback } from 'react';
import { isOverdue, formatDateShort, formatDateFull } from '@/lib/dates';
import { ScheduleTask, ScheduleResponse } from '@/lib/types';
import TodoImage from '@/components/TodoImage';

type StatusKey = 'done' | 'overdue' | 'blocked' | 'ready';

const STATUS: Record<StatusKey, { color: string; bg: string }> = {
  done: { color: '#4B5563', bg: '#F1F0EC' },
  overdue: { color: '#E11D48', bg: '#FFF1F2' },
  blocked: { color: '#475569', bg: '#EEF2F7' },
  ready: { color: '#047857', bg: '#ECFDF5' },
};

function SparkleIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.4 2.4M15.3 15.3l2.4 2.4M17.7 6.3l-2.4 2.4M8.7 15.3l-2.4 2.4" />
    </svg>
  );
}

// Can task `startId` reach `targetId` by walking prerequisite links? Used to
// hide prerequisite options that would create a cycle before the server rejects them.
function reaches(startId: number, targetId: number, byId: Map<number, ScheduleTask>, seen = new Set<number>()): boolean {
  if (startId === targetId) return true;
  if (seen.has(startId)) return false;
  seen.add(startId);
  const t = byId.get(startId);
  if (!t) return false;
  return t.dependsOn.some((d) => reaches(d, targetId, byId, seen));
}

export default function Home() {
  const [view, setView] = useState<'list' | 'timeline'>('list');
  const [newTodo, setNewTodo] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [duration, setDuration] = useState(1);
  const [creating, setCreating] = useState(false);
  const [decomposingId, setDecomposingId] = useState<number | null>(null);
  const [data, setData] = useState<ScheduleResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Deep-linkable views: /?view=timeline opens straight into the timeline.
  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get('view');
    if (v === 'timeline' || v === 'list') setView(v);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/schedule');
      if (!res.ok) throw new Error('Failed to load schedule');
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load todos');
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleAddTodo = async () => {
    if (!newTodo.trim() || creating) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTodo, dueDate: dueDate || undefined, durationDays: duration }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? 'Failed to add todo');
      }
      setNewTodo('');
      setDueDate('');
      setDuration(1);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add todo');
    } finally {
      setCreating(false);
    }
  };

  const patchTodo = async (id: number, body: Record<string, unknown>, failMsg: string) => {
    try {
      const res = await fetch(`/api/todos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      await refresh();
    } catch {
      setError(failMsg);
    }
  };

  const handleDeleteTodo = async (id: number) => {
    try {
      const res = await fetch(`/api/todos/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      await refresh();
    } catch {
      setError('Failed to delete todo');
    }
  };

  const handleAddDependency = async (todoId: number, dependsOnId: number) => {
    setError(null);
    try {
      const res = await fetch(`/api/todos/${todoId}/dependencies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dependsOnId }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? 'Failed to add dependency');
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add dependency');
    }
  };

  const handleRemoveDependency = async (todoId: number, dependsOnId: number) => {
    try {
      const res = await fetch(`/api/todos/${todoId}/dependencies/${dependsOnId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      await refresh();
    } catch {
      setError('Failed to remove dependency');
    }
  };

  const handleDecompose = async (todoId: number) => {
    if (decomposingId !== null) return;
    setDecomposingId(todoId);
    setError(null);
    try {
      const res = await fetch('/api/todos/decompose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ todoId }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? 'Decomposition failed');
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Decomposition failed');
    } finally {
      setDecomposingId(null);
    }
  };

  const rawTasks = data?.tasks ?? [];
  const byId = new Map(rawTasks.map((t) => [t.id, t]));
  const busy = decomposingId !== null;
  const total = Math.max(data?.totalDurationDays ?? 0, 0);
  const startISO = data?.projectStartDate ?? null;
  const startMs = startISO ? new Date(startISO).getTime() : 0;
  const finishISO = startISO ? new Date(startMs + total * 86400000).toISOString() : null;

  // Order the way the design does: soonest start first, criticals ahead of ties.
  const tasks = [...rawTasks].sort(
    (a, b) => a.earliestStartDay - b.earliestStartDay || Number(b.isCritical) - Number(a.isCritical) || a.id - b.id,
  );

  let readyCount = 0, blockedCount = 0, overdueCount = 0;
  const rows = tasks.map((t) => {
    const overdue = isOverdue(t.dueDate) && !t.done;
    const pending = t.dependsOn.filter((id) => !(byId.get(id)?.done)).length;
    let key: StatusKey;
    if (t.done) key = 'done';
    else if (overdue) key = 'overdue';
    else if (t.dependsOn.length && pending > 0) key = 'blocked';
    else key = 'ready';
    if (key === 'ready') readyCount++;
    else if (key === 'blocked') blockedCount++;
    else if (key === 'overdue') overdueCount++;

    const accent = t.done ? '#B8BEB4' : t.isCritical ? '#F59E0B' : key === 'ready' ? '#10B981' : key === 'overdue' ? '#E11D48' : '#94A3B8';
    const barColor = t.done ? '#B8BEB4' : t.isCritical ? '#F59E0B' : '#6366F1';
    const label = key === 'done' ? 'Done' : key === 'overdue' ? 'Overdue' : key === 'blocked' ? `Waiting on ${pending}` : 'Ready to start';
    const candidates = tasks.filter(
      (c) => c.id !== t.id && !t.dependsOn.includes(c.id) && !reaches(c.id, t.id, byId),
    );
    return { t, key, overdue, accent, barColor, label, candidates };
  });

  // Weekly axis ticks for the timeline.
  const ticks: { label: string; left: string }[] = [];
  const denom = Math.max(total, 1);
  const pct = (n: number) => `${(n / denom) * 100}%`;
  for (let d = 0; d <= total; d += 7) ticks.push({ label: formatDateShort(new Date(startMs + d * 86400000)), left: pct(d) });
  if (ticks.length && ticks[ticks.length - 1].left !== '100%') ticks.push({ label: formatDateShort(new Date(startMs + total * 86400000)), left: '100%' });

  const tab = (active: boolean) =>
    `text-[13px] font-semibold px-4 py-1.5 rounded-lg transition ${active ? 'bg-white text-[#23201B] shadow-sm' : 'text-[#8A8378]'}`;

  return (
    <div className="min-h-screen bg-[#F4F1EB] text-[#23201B] pb-20">
      {/* header */}
      <div className="sticky top-0 z-20 bg-[#F4F1EB]/90 backdrop-blur border-b border-[#E4DFD6]">
        <div className="max-w-[1000px] mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-[9px] bg-[#4F46E5] flex items-center justify-center shadow-[0_2px_6px_rgba(79,70,229,0.3)]">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12l5 5L20 6" /></svg>
            </div>
            <div>
              <div className="text-base font-bold tracking-tight leading-none">Things To Do</div>
              <div className="text-[11.5px] text-[#8A8378] mt-0.5">Tasks that know when they can start</div>
            </div>
          </div>
          {tasks.length > 0 && (
            <div className="flex bg-[#EAE5DC] rounded-[10px] p-[3px] gap-0.5">
              <button onClick={() => setView('list')} className={tab(view === 'list')}>List</button>
              <button onClick={() => setView('timeline')} className={tab(view === 'timeline')}>Timeline</button>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-[1000px] mx-auto px-6 py-6">
        {/* summary */}
        {tasks.length > 0 && (
          <div className="bg-white border border-[#E7E2D9] rounded-2xl px-[22px] py-5 mb-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
            <div className="flex items-start justify-between gap-5 flex-wrap">
              <div>
                <div className="text-xs font-semibold tracking-[0.04em] uppercase text-[#9A9184] mb-1.5">Projected finish</div>
                <div className="text-[27px] font-bold tracking-tight leading-tight">{finishISO ? formatDateFull(finishISO) : '—'}</div>
                <div className="text-[13.5px] text-[#6E675B] mt-1.5">
                  {total} {total === 1 ? 'day' : 'days'} of work across {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <SummaryChip color="#047857" bg="#ECFDF5" dot="#059669" label={`${readyCount} ready`} />
                <SummaryChip color="#475569" bg="#EEF2F7" dot="#94A3B8" label={`${blockedCount} waiting`} />
                <SummaryChip color="#BE123C" bg="#FFF1F2" dot="#E11D48" label={`${overdueCount} overdue`} />
              </div>
            </div>
          </div>
        )}

        {/* composer */}
        <div className="bg-white border border-[#E7E2D9] rounded-[14px] p-2 mb-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex gap-2 items-center flex-wrap">
          <div className="flex-1 min-w-[200px] flex items-center gap-2.5 pl-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" strokeWidth="2.4" strokeLinecap="round" className="flex-none"><path d="M12 5v14M5 12h14" /></svg>
            <input
              type="text"
              value={newTodo}
              onChange={(e) => setNewTodo(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddTodo()}
              placeholder="Add a task, e.g. Write launch email"
              className="flex-1 border-none outline-none text-[14.5px] bg-transparent py-2 placeholder:text-[#A79F91]"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <label className="flex items-center gap-1.5 bg-[#F4F1EB] rounded-[9px] px-2.5 py-2 text-[12.5px] text-[#6E675B]" title="How long it takes">
              <span className="font-mono">takes</span>
              <input
                type="number"
                min={1}
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value) || 1)}
                className="w-[26px] border-none outline-none bg-transparent font-mono text-[13px] text-center text-[#23201B]"
              />
              <span>days</span>
            </label>
            <label className="flex items-center gap-1.5 bg-[#F4F1EB] rounded-[9px] px-2.5 py-2 text-[12.5px] text-[#6E675B]" title="Due date (optional)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#A79F91" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="border-none outline-none bg-transparent font-mono text-[12px] text-[#6E675B] w-[112px]"
              />
            </label>
            <button onClick={handleAddTodo} disabled={creating} className="bg-[#4F46E5] text-white text-sm font-semibold px-[18px] py-2.5 rounded-[9px] hover:bg-[#4338CA] transition disabled:opacity-50">
              Add
            </button>
          </div>
        </div>

        {/* error */}
        {error && (
          <div className="flex justify-between gap-3 bg-[#FFF1F2] border border-[#FBD0D6] text-[#9F1239] px-[15px] py-[11px] rounded-[11px] mb-4 text-[13.5px]">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-[#9F1239] text-sm leading-none flex-none" aria-label="Dismiss">✕</button>
          </div>
        )}

        {/* empty */}
        {tasks.length === 0 && !creating && (
          <div className="border-[1.5px] border-dashed border-[#D8D2C6] rounded-2xl px-6 py-[52px] text-center bg-[#FBFAF7]">
            <div className="flex justify-center gap-[5px] mb-4">
              <span className="w-[38px] h-2 rounded-[3px] bg-[#F59E0B]" />
              <span className="w-[58px] h-2 rounded-[3px] bg-[#6366F1]" />
              <span className="w-[30px] h-2 rounded-[3px]" style={{ background: 'repeating-linear-gradient(45deg,#D8D2C6 0 3px,transparent 3px 6px)' }} />
            </div>
            <div className="text-base font-semibold mb-1.5">Add your first task</div>
            <div className="text-[13.5px] text-[#8A8378] max-w-[340px] mx-auto leading-relaxed">
              Give each task a length and say what it waits on. Start dates and your finish date are worked out for you.
            </div>
          </div>
        )}

        {/* creating skeleton */}
        {creating && (
          <div className="bg-white border border-[#E7E2D9] rounded-[14px] p-4 mb-2.5 flex items-center gap-3 animate-pulse">
            <div className="w-[22px] h-[22px] rounded-[7px] bg-[#E7E2D9] flex-none" />
            <div className="flex-grow">
              <div className="h-2.5 bg-[#E7E2D9] rounded w-2/5 mb-2" />
              <div className="h-2 bg-[#F1EEE8] rounded w-1/4" />
            </div>
          </div>
        )}

        {/* ===== LIST VIEW ===== */}
        {tasks.length > 0 && view === 'list' && (
          <div className="flex flex-col gap-2.5">
            {rows.map(({ t, key, overdue, accent, label, candidates }) => {
              const decomposing = decomposingId === t.id;
              const st = STATUS[key];
              return (
                <div
                  key={t.id}
                  className="relative overflow-hidden bg-white rounded-[14px] px-4 py-[15px] shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
                  style={{ border: `1px solid ${overdue ? '#FBD9DE' : '#E7E2D9'}`, borderLeft: `3px solid ${accent}` }}
                >
                  {decomposing && (
                    <div
                      className="absolute inset-0 animate-shimmer pointer-events-none"
                      style={{ background: 'linear-gradient(90deg,transparent,rgba(245,158,11,0.14),transparent)', backgroundSize: '360px 100%' }}
                    />
                  )}
                  <div className="relative flex items-start gap-3">
                    {/* done checkbox */}
                    <button
                      onClick={() => patchTodo(t.id, { done: !t.done }, 'Failed to update task')}
                      title="Mark done"
                      className="w-[22px] h-[22px] flex-none rounded-[7px] flex items-center justify-center mt-px transition"
                      style={{ border: `2px solid ${t.done ? '#10B981' : '#D8D2C6'}`, background: t.done ? '#10B981' : '#fff' }}
                      aria-label={t.done ? 'Mark not done' : 'Mark done'}
                    >
                      {t.done && (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12l5 5L20 6" /></svg>
                      )}
                    </button>

                    {/* Pexels preview for the task */}
                    <TodoImage url={t.imageUrl} alt={t.imageAlt} />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="text-[15px] font-semibold" style={t.done ? { textDecoration: 'line-through', color: '#A79F91' } : undefined}>{t.title}</span>
                        <span className="text-[10.5px] font-bold tracking-[0.03em] uppercase rounded-md px-[7px] py-0.5" style={{ color: st.color, background: st.bg }}>{label}</span>
                      </div>

                      {decomposing ? (
                        <div className="text-[13px] text-[#B45309] mt-[7px]">Breaking this into smaller steps…</div>
                      ) : (
                        <>
                          <div className="flex items-center gap-x-3.5 gap-y-1 flex-wrap mt-[7px] text-[12.5px] text-[#7A7365]">
                            <span>Starts <b className="font-mono font-medium text-[#4B463C]">{formatDateShort(t.earliestStartDate)}</b></span>
                            {t.dueDate && (
                              <span style={overdue ? { color: '#E11D48', fontWeight: 600 } : undefined}>
                                Due <b className="font-mono font-medium">{formatDateShort(t.dueDate)}</b>
                              </span>
                            )}
                            <span className="inline-flex items-center gap-1.5">
                              Length
                              <span className="inline-flex items-center border border-[#E4DFD6] rounded-lg overflow-hidden">
                                <button onClick={() => patchTodo(t.id, { durationDays: Math.max(1, t.durationDays - 1) }, 'Failed to update duration')} className="bg-[#F4F1EB] w-[22px] h-6 text-[#6E675B] text-sm leading-none hover:bg-[#EAE5DC]" aria-label="Decrease duration">−</button>
                                <span className="w-[34px] text-center font-mono text-[12.5px]">{t.durationDays}d</span>
                                <button onClick={() => patchTodo(t.id, { durationDays: t.durationDays + 1 }, 'Failed to update duration')} className="bg-[#F4F1EB] w-[22px] h-6 text-[#6E675B] text-sm leading-none hover:bg-[#EAE5DC]" aria-label="Increase duration">+</button>
                              </span>
                            </span>
                          </div>

                          <div className="flex items-center gap-[7px] flex-wrap mt-2.5">
                            <span className="text-xs text-[#9A9184]">Waits on:</span>
                            {t.dependsOn.length === 0 && <span className="text-xs text-[#BDB6A8]">nothing</span>}
                            {t.dependsOn.map((depId) => (
                              <span key={depId} className="inline-flex items-center gap-1.5 bg-[#F1EFEA] border border-[#E4DFD6] rounded-lg pl-[9px] pr-[5px] py-[3px] text-xs text-[#57514A] font-medium">
                                {byId.get(depId)?.title ?? `#${depId}`}
                                <button onClick={() => handleRemoveDependency(t.id, depId)} title="Remove" className="text-[#B0A99B] hover:text-[#E11D48] text-xs leading-none" aria-label={`Remove dependency on ${byId.get(depId)?.title ?? depId}`}>✕</button>
                              </span>
                            ))}
                            {candidates.length > 0 && (
                              <select
                                value=""
                                onChange={(e) => {
                                  const depId = parseInt(e.target.value);
                                  if (!isNaN(depId)) handleAddDependency(t.id, depId);
                                }}
                                className="text-xs font-semibold text-[#4F46E5] bg-[#EEF2FF] border border-[#C7D2FE] rounded-lg px-[7px] py-1 cursor-pointer outline-none"
                              >
                                <option value="">+ add</option>
                                {candidates.map((c) => (
                                  <option key={c.id} value={c.id}>{c.title}</option>
                                ))}
                              </select>
                            )}
                          </div>
                        </>
                      )}
                    </div>

                    {/* actions */}
                    <div className="flex gap-1 flex-none">
                      <button onClick={() => handleDecompose(t.id)} disabled={busy} title="Break into smaller steps" className="w-[30px] h-[30px] flex items-center justify-center rounded-lg bg-[#F4F2FF] text-[#6D5AE6] hover:bg-[#E7E3FF] disabled:opacity-40 transition">
                        {decomposing ? <span className="animate-pulse">…</span> : <SparkleIcon />}
                      </button>
                      <button onClick={() => handleDeleteTodo(t.id)} disabled={busy} title="Delete" aria-label="Delete task" className="w-[30px] h-[30px] flex items-center justify-center rounded-lg bg-[#F4F1EB] text-[#8A8378] hover:bg-[#FFF1F2] hover:text-[#E11D48] disabled:opacity-40 transition">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ===== TIMELINE VIEW ===== */}
        {tasks.length > 0 && view === 'timeline' && (
          <div className="bg-white border border-[#E7E2D9] rounded-2xl px-5 pt-[18px] pb-[22px] shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
            {/* axis */}
            <div className="flex items-center gap-3.5 pb-2.5">
              <div className="w-[190px] flex-none text-[11px] font-semibold tracking-[0.05em] uppercase text-[#9A9184]">Task</div>
              <div className="flex-1 relative h-4">
                {ticks.map((tk, i) => (
                  <span key={i} className="absolute top-0 -translate-x-1/2 font-mono text-[10px] text-[#A79F91] whitespace-nowrap" style={{ left: tk.left }}>{tk.label}</span>
                ))}
              </div>
            </div>

            {/* rows */}
            <div className="flex flex-col">
              {rows.map(({ t, barColor }) => {
                const slack = t.done ? 0 : t.slackDays;
                return (
                  <div key={t.id} className="flex items-center gap-3.5 py-[7px] border-t border-[#F1EEE8]">
                    <div className="w-[190px] flex-none flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-full flex-none" style={{ background: t.done ? '#B8BEB4' : t.isCritical ? '#F59E0B' : '#6366F1' }} />
                      <span className="text-[13px] font-medium text-[#3A352E] truncate" style={t.done ? { textDecoration: 'line-through', color: '#A79F91' } : undefined}>{t.title}</span>
                    </div>
                    <div className="flex-1 relative h-[22px] rounded-[5px]" style={{ background: 'repeating-linear-gradient(to right,#F3F1EC 0 1px,transparent 1px calc(100%/7))' }}>
                      <span className="absolute -top-1 -bottom-1 w-0.5 bg-[#E11D48] opacity-55" style={{ left: pct(Math.min(Math.max(0, 0), total)) }} />
                      <div
                        title={`${t.title} · ${t.durationDays}d${t.isCritical ? ' · critical' : slack > 0 ? ` · ${slack}d buffer` : ''}`}
                        className="absolute top-[3px] bottom-[3px] rounded-[5px] flex items-center px-[7px] shadow-[0_1px_2px_rgba(0,0,0,0.12)]"
                        style={{ left: pct(t.earliestStartDay), width: pct(t.durationDays), background: barColor }}
                      >
                        <span className="font-mono text-[10px] font-medium text-white whitespace-nowrap overflow-hidden">{t.durationDays}d</span>
                      </div>
                      {slack > 0 && (
                        <div
                          title="buffer, this task can slip without moving the finish"
                          className="absolute top-[5px] bottom-[5px] rounded"
                          style={{ left: pct(t.earliestStartDay + t.durationDays), width: pct(slack), background: 'repeating-linear-gradient(45deg,#D8D2C6 0 3px,transparent 3px 6px)' }}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* legend */}
            <div className="mt-4 pt-3.5 border-t border-[#F1EEE8] flex flex-col gap-[7px]">
              <div className="flex items-center gap-2.5 text-[12.5px] text-[#6E675B]">
                <span className="w-[22px] h-[9px] rounded-[3px] bg-[#F59E0B] flex-none" />
                <b className="font-semibold text-[#B45309]">On the critical path.</b> A delay in any of these pushes your finish date back.
              </div>
              <div className="flex items-center gap-2.5 text-[12.5px] text-[#6E675B]">
                <span className="w-[22px] h-[9px] rounded-[3px] bg-[#6366F1] flex-none" />
                Scheduled, with some room to move.
              </div>
              <div className="flex items-center gap-2.5 text-[12.5px] text-[#6E675B]">
                <span className="w-[22px] h-[9px] rounded-[3px] flex-none" style={{ background: 'repeating-linear-gradient(45deg,#D8D2C6 0 3px,transparent 3px 6px)' }} />
                Buffer, how long it could slip before it matters. The <span className="text-[#E11D48] font-semibold">&nbsp;red line&nbsp;</span> is today.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryChip({ color, bg, dot, label }: { color: string; bg: string; dot: string; label: string }) {
  return (
    <div className="inline-flex items-center gap-[7px] rounded-[9px] px-[11px] py-1.5 text-[12.5px] font-semibold" style={{ background: bg, color }}>
      <span className="w-[7px] h-[7px] rounded-full inline-block" style={{ background: dot }} />
      {label}
    </div>
  );
}
