'use client';
import { useState } from 'react';

/** Pexels thumbnail for a todo, with a pulsing skeleton until the image loads.
 *  Renders nothing when the todo has no image. */
export default function TodoImage({ url, alt }: { url: string | null; alt: string | null }) {
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
