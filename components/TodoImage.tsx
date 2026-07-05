'use client';
import { useState } from 'react';

const SIZE = 'w-10 h-10'; // 40px, matches the modern list-row spec

/** Pexels thumbnail for a todo. Shows a pulsing skeleton until the image loads,
 *  and a neutral image-placeholder glyph when the todo has no image. */
export function TodoImage({ url, alt }: { url: string | null; alt: string | null }) {
  const [loaded, setLoaded] = useState(false);

  if (!url) {
    return (
      <div
        className={`${SIZE} rounded-lg bg-stone-100 border border-stone-200 flex-shrink-0 flex items-center justify-center text-stone-300`}
        aria-hidden
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <circle cx="8.5" cy="10.5" r="1.5" />
          <path d="M21 15l-5-5L5 21" />
        </svg>
      </div>
    );
  }

  return (
    <div className={`relative ${SIZE} rounded-lg overflow-hidden flex-shrink-0 bg-stone-100`}>
      {!loaded && <div className="absolute inset-0 animate-pulse bg-stone-200" />}
      <img
        src={url}
        alt={alt ?? ''}
        className={`${SIZE} object-cover`}
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
}

export default TodoImage;
