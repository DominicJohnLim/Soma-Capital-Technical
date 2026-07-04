import React from 'react';
import { TodoImage } from 'soma-todo-app';

// Self-contained SVG photo stand-ins — previews must render offline.
const photo = (bg: string, fg: string, label: string) =>
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128">` +
      `<rect width="128" height="128" fill="${bg}"/>` +
      `<circle cx="64" cy="52" r="26" fill="${fg}"/>` +
      `<rect x="24" y="88" width="80" height="14" rx="7" fill="${fg}"/>` +
      `<title>${label}</title></svg>`,
  );

export const Thumbnail = () => (
  <TodoImage url={photo('#fdba74', '#c2410c', 'walk the dog')} alt="walk the dog" />
);

// The component in its natural habitat: leading a todo card row.
export const InTodoCard = () => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      background: '#fff',
      borderRadius: 8,
      padding: 16,
      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
      width: 360,
    }}
  >
    <TodoImage url={photo('#93c5fd', '#1d4ed8', 'water the plants')} alt="water the plants" />
    <div>
      <div style={{ fontWeight: 500, color: '#1f2937' }}>Water the plants</div>
      <div style={{ fontSize: 13, color: '#6b7280' }}>Due Jul 10, 2026</div>
    </div>
  </div>
);
