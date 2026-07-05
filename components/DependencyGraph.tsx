'use client';
import { useMemo } from 'react';
import ReactFlow, { Background, Controls, Edge, Node, MarkerType } from 'reactflow';
import dagre from 'dagre';
import 'reactflow/dist/style.css';
import { ScheduleTask } from '@/lib/types';
import { formatDateShort } from '@/lib/dates';

const NODE_W = 190;
const NODE_H = 56;

// Stable references so React Flow doesn't warn about recreated type maps.
const NODE_TYPES = {};
const EDGE_TYPES = {};

function layout(
  tasks: ScheduleTask[],
  criticalPath: number[],
): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  // Top-down: prerequisites above their dependents.
  g.setGraph({ rankdir: 'TB', nodesep: 42, ranksep: 64, marginx: 12, marginy: 12 });

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
            <div className="flex items-center justify-between gap-1.5">
              <span className="font-semibold text-[13px] text-stone-900 truncate">{t.title}</span>
              {!t.isCritical && t.slackDays > 0 && (
                <span className="font-mono text-[8.5px] text-stone-400 border border-dashed border-stone-300 rounded px-1 flex-shrink-0">
                  +{t.slackDays}d slack
                </span>
              )}
            </div>
            <div className="font-mono text-[10px] text-stone-500 mt-0.5">
              {t.durationDays}d · {formatDateShort(t.earliestStartDate)}
            </div>
          </div>
        ),
      },
      style: {
        width: NODE_W,
        borderRadius: 9,
        border: critical.has(t.id) ? '1.5px solid #f59e0b' : '1px solid #e7e5e4',
        background: critical.has(t.id) ? '#fffbeb' : '#ffffff',
        boxShadow: '0 1px 2px rgba(28,25,23,0.06)',
        padding: '8px 11px',
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
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 16,
        height: 16,
        color: isCriticalEdge ? '#f59e0b' : '#a8a29e',
      },
      style: isCriticalEdge
        ? { stroke: '#f59e0b', strokeWidth: 2.5, strokeDasharray: '6 4' }
        : { stroke: '#d6d3d1', strokeWidth: 1.5 },
    };
  });

  return { nodes, edges };
}

export function DependencyGraph({
  tasks,
  criticalPath,
}: {
  tasks: ScheduleTask[];
  criticalPath: number[];
}) {
  const { nodes, edges } = useMemo(() => layout(tasks, criticalPath), [tasks, criticalPath]);
  if (tasks.length === 0) return null;
  return (
    <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-1.5 h-[360px] sm:h-[440px]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.3}
        nodesDraggable={false}
        nodesConnectable={false}
        proOptions={{ hideAttribution: true }}
        className="rounded-lg"
      >
        <Background color="#e7e5e4" gap={20} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}

export default DependencyGraph;
