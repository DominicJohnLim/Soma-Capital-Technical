"use client"
import { Todo } from '@prisma/client';
import { useState, useEffect } from 'react';
import { isOverdue, formatDate } from '@/lib/dates';

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
  const [creating, setCreating] = useState(false);
  const [todos, setTodos] = useState([]);

  useEffect(() => {
    fetchTodos();
  }, []);

  const fetchTodos = async () => {
    try {
      const res = await fetch('/api/todos');
      const data = await res.json();
      setTodos(data);
    } catch (error) {
      console.error('Failed to fetch todos:', error);
    }
  };

  const handleAddTodo = async () => {
    if (!newTodo.trim() || creating) return;
    setCreating(true);
    try {
      await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTodo, dueDate: dueDate || undefined }),
      });
      setNewTodo('');
      setDueDate('');
      await fetchTodos();
    } catch (error) {
      console.error('Failed to add todo:', error);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteTodo = async (id:any) => {
    try {
      await fetch(`/api/todos/${id}`, {
        method: 'DELETE',
      });
      fetchTodos();
    } catch (error) {
      console.error('Failed to delete todo:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-500 to-red-500 flex flex-col items-center p-4">
      <div className="w-full max-w-md">
        <h1 className="text-4xl font-bold text-center text-white mb-8">Things To Do App</h1>
        <div className="flex mb-6">
          <input
            type="text"
            className="flex-grow p-3 rounded-l-full focus:outline-none text-gray-700"
            placeholder="Add a new todo"
            value={newTodo}
            onChange={(e) => setNewTodo(e.target.value)}
          
          />
          <input
            type="date"
            className="p-3 text-gray-700 focus:outline-none"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
          <button
            onClick={handleAddTodo}
            className="bg-white text-indigo-600 p-3 rounded-r-full hover:bg-gray-100 transition duration-300"
          >
            Add
          </button>
        </div>
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
          {todos.map((todo:Todo) => (
            <li
              key={todo.id}
              className="flex justify-between items-center bg-white bg-opacity-90 p-4 mb-4 rounded-lg shadow-lg"
            >
              <TodoImage url={todo.imageUrl} alt={todo.imageAlt} />
              <div className="flex-grow">
                <span className="text-gray-800">{todo.title}</span>
                {todo.dueDate && (
                  <div
                    className={
                      isOverdue(todo.dueDate)
                        ? 'text-sm text-red-600 font-semibold'
                        : 'text-sm text-gray-500'
                    }
                  >
                    Due {formatDate(todo.dueDate)}
                  </div>
                )}
              </div>
              <button
                onClick={() => handleDeleteTodo(todo.id)}
                className="text-red-500 hover:text-red-700 transition duration-300"
              >
                {/* Delete Icon */}
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
