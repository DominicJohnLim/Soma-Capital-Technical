"use client"
import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { isOverdue, formatDate } from '@/lib/dates';
import { ScheduleTask, ScheduleResponse } from '@/lib/types';

// reactflow needs the DOM — render client-side only.
const DependencyGraph = dynamic(() => import('@/components/DependencyGraph'), { ssr: false });

function TodoImage({ url, alt }: { url: string | null; alt: string | null }) {
  const [loaded, setLoaded] = useState(false);
  if (!url) return null;
  return (
    <div className="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-gray-200 mr-3">
      {!loaded && <div className="absolute inset-0 animate-pulse bg-gray-300" />}
      <img
        src={url}
        alt={alt ?? ''}
        className="w-16 h-16 object-cover"
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
}

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

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-500 to-red-500 flex flex-col items-center p-4">
      <div className="w-full max-w-3xl">
        <h1 className="text-4xl font-bold text-center text-white mb-2">Things To Do App</h1>
        {tasks.length > 0 && (
          <p className="text-center text-orange-100 mb-6">
            Project duration: {data!.totalDurationDays} day
            {data!.totalDurationDays === 1 ? '' : 's'} along the critical path
          </p>
        )}

        <div className="flex mb-4 bg-white rounded-full overflow-hidden shadow-lg">
          <input
            type="text"
            className="flex-grow p-3 focus:outline-none text-gray-700"
            placeholder="Add a new todo"
            value={newTodo}
            onChange={(e) => setNewTodo(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddTodo()}
          />
          <input
            type="date"
            title="Due date"
            className="p-3 text-gray-700 focus:outline-none border-l"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
          <label className="flex items-center gap-1 p-3 border-l text-gray-500 text-sm">
            <input
              type="number"
              min={1}
              title="Estimated duration in days"
              className="w-14 text-gray-700 focus:outline-none"
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value) || 1)}
            />
            d
          </label>
          <button
            onClick={handleAddTodo}
            disabled={creating}
            className="bg-indigo-600 text-white px-6 hover:bg-indigo-700 transition duration-300 disabled:opacity-50"
          >
            Add
          </button>
        </div>

        {error && (
          <div className="flex justify-between items-center bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="font-bold ml-4">
              ✕
            </button>
          </div>
        )}

        <ul>
          {creating && (
            <li className="flex items-center bg-white bg-opacity-60 p-4 mb-4 rounded-lg shadow-lg animate-pulse">
              <div className="w-16 h-16 rounded-lg bg-gray-300 mr-3" />
              <div className="flex-grow">
                <div className="h-4 bg-gray-300 rounded w-2/3 mb-2" />
                <div className="h-3 bg-gray-200 rounded w-1/3" />
              </div>
            </li>
          )}
          {tasks.map((todo: ScheduleTask) => (
            <li key={todo.id} className="bg-white bg-opacity-90 p-4 mb-4 rounded-lg shadow-lg">
              <div className="flex items-start">
                <TodoImage url={todo.imageUrl} alt={todo.imageAlt} />
                <div className="flex-grow min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-gray-800 font-medium">{todo.title}</span>
                    {todo.isCritical && (
                      <span className="text-xs bg-amber-100 text-amber-800 border border-amber-300 rounded-full px-2 py-0.5">
                        Critical path
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-500 flex items-center gap-3 flex-wrap mt-1">
                    {todo.dueDate && (
                      <span
                        className={
                          isOverdue(todo.dueDate) ? 'text-red-600 font-semibold' : undefined
                        }
                      >
                        Due {formatDate(todo.dueDate)}
                      </span>
                    )}
                    <span>Earliest start {formatDate(todo.earliestStartDate)}</span>
                    <label className="flex items-center gap-1" title="Duration (days)">
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
                        className="w-12 border rounded px-1 text-gray-700"
                      />
                      d
                    </label>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap mt-2">
                    {todo.dependsOn.map((depId) => (
                      <span
                        key={depId}
                        className="text-xs bg-gray-100 text-gray-700 border border-gray-300 rounded-full px-2 py-0.5 flex items-center gap-1"
                      >
                        after {titleById.get(depId) ?? `#${depId}`}
                        <button
                          onClick={() => handleRemoveDependency(todo.id, depId)}
                          className="text-gray-400 hover:text-red-600"
                          title="Remove dependency"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                    {tasks.length > 1 && (
                      <select
                        value=""
                        onChange={(e) => {
                          const depId = parseInt(e.target.value);
                          if (!isNaN(depId)) handleAddDependency(todo.id, depId);
                        }}
                        className="text-xs text-gray-500 border border-dashed border-gray-300 rounded-full px-2 py-0.5 bg-transparent"
                      >
                        <option value="">+ depends on…</option>
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
                </div>
                <button
                  onClick={() => handleDecompose(todo.id)}
                  disabled={decomposingId !== null}
                  className="text-indigo-500 hover:text-indigo-700 transition duration-300 ml-2 flex-shrink-0 disabled:opacity-40"
                  title="AI: split into scheduled subtasks"
                >
                  {decomposingId === todo.id ? (
                    <span className="inline-block w-5 animate-pulse">…</span>
                  ) : (
                    '✨'
                  )}
                </button>
                <button
                  onClick={() => handleDeleteTodo(todo.id)}
                  className="text-red-500 hover:text-red-700 transition duration-300 ml-2 flex-shrink-0"
                  title="Delete todo"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </li>
          ))}
        </ul>

        {tasks.length > 0 && (
          <>
            <h2 className="text-2xl font-bold text-white mt-8 mb-4">Dependency Graph</h2>
            <DependencyGraph tasks={tasks} criticalPath={data?.criticalPath ?? []} />
          </>
        )}
      </div>
    </div>
  );
}
