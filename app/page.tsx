"use client"
import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { isOverdue, formatDate, formatDateShort } from '@/lib/dates';
import { ScheduleTask, ScheduleResponse } from '@/lib/types';
import TodoImage from '@/components/TodoImage';
import ScheduleRail from '@/components/ScheduleRail';

// reactflow needs the DOM — render client-side only.
const DependencyGraph = dynamic(() => import('@/components/DependencyGraph'), { ssr: false });

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

const axis = (iso: string) => formatDateShort(iso).toUpperCase();

export default function Home() {
  const [newTodo, setNewTodo] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [duration, setDuration] = useState(1);
  const [creating, setCreating] = useState(false);
  const [decomposingId, setDecomposingId] = useState<number | null>(null);
  const [data, setData] = useState<ScheduleResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        body: JSON.stringify({
          title: newTodo,
          dueDate: dueDate || undefined,
          durationDays: duration,
        }),
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
      const res = await fetch(`/api/todos/${todoId}/dependencies/${dependsOnId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error();
      await refresh();
    } catch {
      setError('Failed to remove dependency');
    }
  };

  const handleDurationChange = async (todoId: number, durationDays: number, previous: number) => {
    if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays === previous) return;
    try {
      const res = await fetch(`/api/todos/${todoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ durationDays }),
      });
      if (!res.ok) throw new Error();
      await refresh();
    } catch {
      setError('Failed to update duration');
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

  const tasks = data?.tasks ?? [];
  const titleById = new Map(tasks.map((t) => [t.id, t.title]));
  const busy = decomposingId !== null;
  const total = data?.totalDurationDays ?? 0;
  const startISO = data?.projectStartDate ?? null;
  const finishISO =
    startISO && total > 0
      ? new Date(new Date(startISO).getTime() + total * 86400000).toISOString()
      : startISO;

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <div className="max-w-2xl mx-auto px-4 py-6 sm:py-10">
        {/* header */}
        <div className="flex items-center justify-between mb-6 gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-orange-600 flex items-center justify-center">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12l5 5L20 6" />
              </svg>
            </div>
            <h1 className="text-[17px] font-semibold tracking-tight">Things To Do</h1>
          </div>
          {tasks.length > 0 && (
            <div className="flex items-center gap-3">
              {finishISO && (
                <span className="hidden sm:inline font-mono text-xs text-stone-500">
                  finishes <span className="text-stone-900 font-semibold">{formatDateShort(finishISO)}</span>
                </span>
              )}
              <span className="flex items-center gap-1.5 font-mono text-[11px] sm:text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1">
                <span className="w-3 border-t-2 border-dashed border-amber-500 inline-block" />
                {total}d critical path
              </span>
            </div>
          )}
        </div>

        {/* add form */}
        <div className="group flex flex-col sm:flex-row sm:items-center gap-2 bg-white border border-stone-200 rounded-xl shadow-sm focus-within:ring-[3px] focus-within:ring-orange-600/15 focus-within:border-orange-300 transition p-1.5 sm:pl-3 mb-4">
          <div className="flex items-center gap-2 flex-grow">
            <div className="w-7 h-7 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center flex-shrink-0">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </div>
            <input
              type="text"
              className="flex-grow py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none bg-transparent"
              placeholder="What needs to get done?"
              value={newTodo}
              onChange={(e) => setNewTodo(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddTodo()}
            />
          </div>
          <div className="flex items-center gap-1.5">
            <label className="flex items-center gap-1.5 bg-stone-100 rounded-lg px-2.5 py-2 text-stone-600 font-mono text-[11.5px]" title="Due date">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a8a29e" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
              <input
                type="date"
                className="focus:outline-none bg-transparent text-stone-700 w-[104px]"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </label>
            <label className="flex items-center gap-1 bg-stone-100 rounded-lg px-2.5 py-2 text-stone-600 font-mono text-[11.5px]" title="Estimated duration in days">
              <input
                type="number"
                min={1}
                className="w-6 focus:outline-none bg-transparent text-stone-900 text-right"
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value) || 1)}
              />
              d
            </label>
            <button
              onClick={handleAddTodo}
              disabled={creating}
              className="bg-orange-600 text-white text-sm font-semibold px-4 rounded-lg hover:bg-orange-700 transition disabled:opacity-50 min-h-[40px]"
            >
              Add task
            </button>
          </div>
        </div>

        {/* error banner */}
        {error && (
          <div className="flex justify-between items-start gap-3 bg-white border border-red-200 px-4 py-3 rounded-xl mb-4 text-[13px] text-stone-600 leading-relaxed shadow-sm">
            <span>
              <span className="text-red-600 font-semibold">Can’t do that.</span> {error}
            </span>
            <button onClick={() => setError(null)} className="text-stone-400 hover:text-stone-600 flex-shrink-0" aria-label="Dismiss">
              ✕
            </button>
          </div>
        )}

        {/* empty state */}
        {tasks.length === 0 && !creating ? (
          <div className="border-[1.5px] border-dashed border-stone-300 rounded-xl px-8 py-11 text-center">
            <div className="flex justify-center gap-1 mb-4">
              <span className="w-[34px] h-2 rounded-[2px] bg-amber-500" />
              <span className="w-[52px] h-2 rounded-[2px] bg-amber-500" />
              <span
                className="w-[26px] h-2 rounded-[2px]"
                style={{ background: 'repeating-linear-gradient(45deg, #d6d3d1 0 3px, transparent 3px 6px)' }}
              />
            </div>
            <div className="text-[15px] font-semibold mb-1">Plan your first task</div>
            <div className="text-[13px] text-stone-500 max-w-sm mx-auto leading-relaxed">
              Give tasks durations and link them with dependencies — start dates and the critical
              path are computed as you go.
            </div>
          </div>
        ) : (
          <div className="bg-white border border-stone-200 rounded-xl shadow-sm overflow-hidden">
            {/* timeline axis header */}
            <div className="flex items-center justify-between px-4 py-2 bg-stone-50 border-b border-stone-100 font-mono text-[9.5px] tracking-[0.07em] text-stone-400">
              <span>{tasks.length} {tasks.length === 1 ? 'TASK' : 'TASKS'}</span>
              {startISO && finishISO && total > 0 && (
                <span>{axis(startISO)} — {axis(finishISO)}</span>
              )}
            </div>

            <div className="divide-y divide-stone-100">
              {creating && (
                <div className="p-3.5 flex items-center gap-3 animate-pulse">
                  <div className="w-10 h-10 rounded-lg bg-stone-200 flex-shrink-0" />
                  <div className="flex-grow">
                    <div className="h-2.5 bg-stone-200 rounded w-2/5 mb-2" />
                    <div className="h-2 bg-stone-100 rounded w-1/4" />
                  </div>
                </div>
              )}

              {tasks.map((todo: ScheduleTask) => {
                const decomposing = decomposingId === todo.id;
                const overdue = isOverdue(todo.dueDate);
                return (
                  <div key={todo.id}>
                    <div className={`relative overflow-hidden ${decomposing ? 'bg-amber-50' : ''}`}>
                      {decomposing && (
                        <div
                          className="absolute inset-0 animate-shimmer pointer-events-none"
                          style={{
                            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.8), transparent)',
                            backgroundSize: '400px 100%',
                          }}
                        />
                      )}
                      <div className="relative flex items-start gap-3 p-3.5">
                        {!decomposing && <TodoImage url={todo.imageUrl} alt={todo.imageAlt} />}
                        <div className="flex-grow min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-stone-900">{todo.title}</span>
                            {todo.isCritical && !decomposing && (
                              <span className="font-mono text-[9px] font-semibold tracking-[0.07em] bg-amber-50 text-amber-700 border border-amber-200 rounded px-1.5 py-0.5">
                                CRITICAL
                              </span>
                            )}
                            {overdue && !decomposing && (
                              <span className="font-mono text-[9px] font-semibold tracking-[0.07em] bg-red-50 text-red-600 border border-red-200 rounded px-1.5 py-0.5">
                                OVERDUE
                              </span>
                            )}
                          </div>

                          {decomposing ? (
                            <div className="text-[12.5px] text-amber-700 mt-1 flex items-center gap-1.5">
                              <span className="animate-pulse">✨</span>
                              Splitting into subtasks — estimating durations &amp; dependencies…
                            </div>
                          ) : (
                            <>
                              <div className="text-[12.5px] text-stone-500 flex items-center gap-x-3 gap-y-1 flex-wrap mt-1">
                                {todo.dueDate && (
                                  <span className={overdue ? 'text-red-600 font-semibold' : undefined}>
                                    due <span className="font-mono text-[11.5px]">{formatDateShort(todo.dueDate)}</span>
                                  </span>
                                )}
                                <span>
                                  starts{' '}
                                  <span className="font-mono text-[11.5px] text-stone-600">
                                    {formatDateShort(todo.earliestStartDate)}
                                  </span>
                                </span>
                                <label className="flex items-center gap-1.5" title="Duration (days)">
                                  <input
                                    type="number"
                                    min={1}
                                    key={`${todo.id}-${todo.durationDays}`}
                                    defaultValue={todo.durationDays}
                                    onBlur={(e) =>
                                      handleDurationChange(todo.id, parseInt(e.target.value), todo.durationDays)
                                    }
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                    }}
                                    className="w-9 border border-stone-200 bg-white rounded-md px-1 py-0.5 text-stone-900 text-center font-mono text-[11.5px] focus:outline-none focus:border-orange-400"
                                  />
                                  <span>day{todo.durationDays === 1 ? '' : 's'}</span>
                                </label>
                              </div>

                              <div className="flex items-center gap-1.5 flex-wrap mt-2">
                                {todo.dependsOn.map((depId) => (
                                  <span
                                    key={depId}
                                    className="text-[11.5px] font-medium bg-stone-100 text-stone-600 rounded-md pl-2 pr-1.5 py-0.5 flex items-center gap-1.5"
                                  >
                                    ← {titleById.get(depId) ?? `#${depId}`}
                                    <button
                                      onClick={() => handleRemoveDependency(todo.id, depId)}
                                      className="text-stone-400 hover:text-red-600"
                                      title="Remove dependency"
                                      aria-label={`Remove dependency on ${titleById.get(depId) ?? depId}`}
                                    >
                                      ✕
                                    </button>
                                  </span>
                                ))}
                                {tasks.length > 1 &&
                                  tasks.some((t) => t.id !== todo.id && !todo.dependsOn.includes(t.id)) && (
                                    <select
                                      value=""
                                      onChange={(e) => {
                                        const depId = parseInt(e.target.value);
                                        if (!isNaN(depId)) handleAddDependency(todo.id, depId);
                                      }}
                                      className="text-[11.5px] font-semibold text-orange-600 bg-orange-50 border border-orange-300 rounded-md px-2 py-0.5 focus:outline-none focus:border-orange-500 cursor-pointer"
                                    >
                                      <option value="">+ dependency</option>
                                      {tasks
                                        .filter((t) => t.id !== todo.id && !todo.dependsOn.includes(t.id))
                                        .map((t) => (
                                          <option key={t.id} value={t.id}>
                                            {t.title}
                                          </option>
                                        ))}
                                    </select>
                                  )}
                              </div>
                            </>
                          )}
                        </div>

                        {/* desktop rail column */}
                        {!decomposing && (
                          <div className="hidden sm:block w-[170px] flex-shrink-0 mt-2">
                            <ScheduleRail
                              startDay={todo.earliestStartDay}
                              durationDays={todo.durationDays}
                              slackDays={todo.slackDays}
                              totalDays={total}
                              isCritical={todo.isCritical}
                            />
                          </div>
                        )}

                        {/* actions */}
                        <div className="flex gap-1 flex-shrink-0">
                          <button
                            onClick={() => handleDecompose(todo.id)}
                            disabled={busy}
                            className="w-11 h-11 sm:w-7 sm:h-7 flex items-center justify-center rounded-md text-indigo-500 bg-transparent sm:bg-stone-100 hover:bg-indigo-50 disabled:opacity-40 transition text-[13px]"
                            title="AI: split into scheduled subtasks"
                          >
                            {decomposing ? <span className="animate-pulse">…</span> : '✨'}
                          </button>
                          <button
                            onClick={() => handleDeleteTodo(todo.id)}
                            disabled={busy}
                            className="w-11 h-11 sm:w-7 sm:h-7 flex items-center justify-center rounded-md text-stone-500 bg-transparent sm:bg-stone-100 hover:text-red-600 hover:bg-red-50 disabled:opacity-40 transition"
                            title="Delete todo"
                            aria-label="Delete todo"
                          >
                            <XIcon className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* mobile full-width rail */}
                      {!decomposing && (
                        <div className="sm:hidden px-3.5 pb-3.5 -mt-1">
                          <ScheduleRail
                            startDay={todo.earliestStartDay}
                            durationDays={todo.durationDays}
                            slackDays={todo.slackDays}
                            totalDays={total}
                            isCritical={todo.isCritical}
                            showLabel={false}
                          />
                        </div>
                      )}
                    </div>

                    {/* indented skeleton subtasks while decomposing */}
                    {decomposing &&
                      [0, 1].map((i) => (
                        <div key={i} className="pl-11 pr-3.5 py-3.5 flex items-center gap-3 animate-pulse border-t border-stone-100">
                          <div className="w-10 h-10 rounded-lg bg-stone-200 flex-shrink-0" />
                          <div className="flex-grow">
                            <div className="h-2.5 bg-stone-200 rounded w-2/5 mb-2" />
                            <div className="h-2 bg-stone-100 rounded w-1/4" />
                          </div>
                        </div>
                      ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* legend */}
        {tasks.length > 0 && (
          <div className="hidden sm:flex items-center gap-4 mt-2.5 px-1 font-mono text-[10px] text-stone-500">
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-1.5 rounded-[2px] bg-amber-500 inline-block" />
              critical — 0 slack, sets the finish date
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-1.5 rounded-[2px] bg-stone-300 inline-block" />
              scheduled
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className="w-4 h-1.5 rounded-[2px] inline-block"
                style={{ background: 'repeating-linear-gradient(45deg, #d6d3d1 0 3px, transparent 3px 6px)' }}
              />
              slack
            </span>
          </div>
        )}

        {/* dependency graph */}
        {tasks.length > 0 && (
          <>
            <div className="flex items-baseline justify-between mt-8 mb-3">
              <h2 className="text-sm font-semibold tracking-tight">Dependency graph</h2>
              <span className="text-xs text-stone-400 flex items-center gap-1.5">
                <span className="w-3.5 border-t-2 border-dashed border-amber-500 inline-block" />
                critical path
              </span>
            </div>
            <DependencyGraph tasks={tasks} criticalPath={data?.criticalPath ?? []} />
          </>
        )}
      </div>
    </div>
  );
}
