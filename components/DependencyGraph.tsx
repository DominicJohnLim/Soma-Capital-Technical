'use client';
import { useMemo } from 'react';
import ReactFlow, { Background, Controls, Edge, Node, MarkerType } from 'reactflow';
import dagre from 'dagre';
import 'reactflow/dist/style.css';
import { ScheduleTask } from '@/lib/types';
import { formatDate } from '@/lib/dates';

const NODE_W = 200;
const NODE_H = 72;

// Stable references so React Flow doesn't warn about recreated type maps.
const NODE_TYPES = {};
const EDGE_TYPES = {};

function layout(
  tasks: ScheduleTask[],
  criticalPath: number[],
): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', nodesep: 40, ranksep: 60 });

  for (const t of tasks) g.setNode(String(t.id), { width: NODE_W, height: NODE_H });
  const edgePairs: Array<[number, number]> = [];
  for (const t of tasks) {
    for (const dep of t.dependsOn) {
      g.setEdge(String(dep), String(t.id)); // prerequisite -> dependent
      edgePairs.push([dep, t.id]);
    }
  }
  dagre.layout(g);

  const critical = new Set(tasks.filter((t) => t.isCritical).map((t) => t.id));
  const nodes: Node[] = tasks.map((t) => {
    const pos = g.node(String(t.id));
    return {
      id: String(t.id),
      position: { x: pos.x - NODE_W / 2, y: pos.y - NODE_H / 2 },
      data: {
        label: (
          <div className="text-left">
            <div className="font-semibold text-sm truncate">{t.title}</div>
            <div className="text-xs text-gray-500">
              {t.durationDays}d · starts {formatDate(t.earliestStartDate)}
            </div>
          </div>
        ),
      },
      style: {
        width: NODE_W,
        borderRadius: 8,
        border: critical.has(t.id) ? '2px solid #f59e0b' : '1px solid #d1d5db',
        background: critical.has(t.id) ? '#fffbeb' : '#ffffff',
        padding: 8,
      },
    };
  });

  // Only consecutive critical-path edges are highlighted — two critical nodes
  // can also be joined by a redundant shortcut edge that is not on the path.
  const criticalEdges = new Set(
    criticalPath.slice(1).map((id, i) => `${criticalPath[i]}->${id}`),
  );
  const edges: Edge[] = edgePairs.map(([from, to]) => {
    const isCriticalEdge = criticalEdges.has(`${from}->${to}`);
    return {
      id: `${from}-${to}`,
      source: String(from),
      target: String(to),
      animated: isCriticalEdge,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: isCriticalEdge
        ? { stroke: '#f59e0b', strokeWidth: 2.5 }
        : { stroke: '#9ca3af', strokeWidth: 1.5 },
    };
  });

  return { nodes, edges };
}

export default function DependencyGraph({
  tasks,
  criticalPath,
}: {
  tasks: ScheduleTask[];
  criticalPath: number[];
}) {
  const { nodes, edges } = useMemo(() => layout(tasks, criticalPath), [tasks, criticalPath]);
  if (tasks.length === 0) return null;
  return (
    <div className="bg-white bg-opacity-90 rounded-lg shadow-lg p-2" style={{ height: 420 }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        fitView
        nodesDraggable={false}
        nodesConnectable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
