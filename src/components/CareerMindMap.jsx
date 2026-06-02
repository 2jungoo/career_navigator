import { useEffect, useMemo } from 'react';
import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

const CARD_WIDTH = 240;
const CENTER_X = 440;
const JOB_X = 780;
const LAB_X = 80;

function CenterNode({ data }) {
  return (
    <div
      className="rounded-3xl px-6 py-4 text-center shadow-xl"
      style={{
        background: 'linear-gradient(135deg, #1d4ed8, #2563eb 58%, #60a5fa)',
        border: '1px solid rgba(191,219,254,0.7)',
        minWidth: 210,
      }}
    >
      <Handle type="source" position={Position.Left} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
      <p className="mb-1 text-[11px] uppercase tracking-[0.22em] text-blue-100/80">Primary track</p>
      <p className="text-sm font-semibold text-white">{data.label}</p>
    </div>
  );
}

function RecommendationNode({ data, selected, tone }) {
  const accent = tone === 'job' ? '#3b82f6' : '#8b5cf6';
  const muted = tone === 'job' ? '#60a5fa' : '#c084fc';

  return (
    <button
      type="button"
      onClick={() => data.onSelect?.(data)}
      className="w-full rounded-2xl px-4 py-3 text-left transition-transform duration-150 hover:-translate-y-0.5"
      style={{
        minWidth: CARD_WIDTH,
        background: selected ? 'rgba(15,23,42,0.98)' : 'rgba(15,23,42,0.88)',
        border: `1px solid ${selected ? accent : 'rgba(71,85,105,0.9)'}`,
        boxShadow: selected ? `0 0 0 1px ${accent}30, 0 18px 38px rgba(2,6,23,0.38)` : 'none',
      }}
    >
      <Handle
        type="target"
        position={tone === 'job' ? Position.Left : Position.Right}
        style={{ opacity: 0 }}
      />
      {tone === 'job' && <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />}
      <p className="mb-1 text-[11px] uppercase tracking-[0.18em]" style={{ color: muted }}>
        {tone === 'job' ? data.category : 'Lab recommendation'}
      </p>
      <p className="line-clamp-2 text-sm font-semibold text-slate-100">{data.label}</p>
      <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">
        {tone === 'job' ? data.summary?.[0] : data.field}
      </p>
      <div className="mt-3 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
          <div className="h-full rounded-full" style={{ width: `${data.score}%`, background: accent }} />
        </div>
        <span className="text-xs font-medium text-slate-300">{data.score}%</span>
      </div>
    </button>
  );
}

function JobNode(props) {
  return <RecommendationNode {...props} tone="job" />;
}

function LabNode(props) {
  return <RecommendationNode {...props} tone="lab" />;
}

const nodeTypes = {
  center: CenterNode,
  job: JobNode,
  lab: LabNode,
};

function distributeY(count, centerY, gap) {
  if (count <= 1) {
    return [centerY];
  }

  const start = centerY - ((count - 1) * gap) / 2;
  return Array.from({ length: count }, (_, index) => start + index * gap);
}

function buildGraph(result, selectedNode, onSelectNode) {
  if (!result) {
    return { nodes: [], edges: [] };
  }

  const rowCount = Math.max(result.jobRecommendations.length, result.labRecommendations.length, 1);
  const centerY = Math.max(220, rowCount * 90);
  const jobPositions = distributeY(result.jobRecommendations.length, centerY, 160);
  const labPositions = distributeY(result.labRecommendations.length, centerY, 160);

  const nodes = [
    {
      id: 'center',
      type: 'center',
      position: { x: CENTER_X, y: centerY },
      data: { label: result.domainLabel },
      draggable: false,
      selectable: false,
    },
  ];

  const edges = [];

  result.jobRecommendations.forEach((job, index) => {
    const id = `job_${job.id}`;

    nodes.push({
      id,
      type: 'job',
      position: { x: JOB_X, y: jobPositions[index] },
      data: {
        ...job,
        category: 'Career path',
        onSelect: () => onSelectNode({ type: 'job', ...job }),
      },
      draggable: false,
      selected: selectedNode?.id === job.id,
    });

    edges.push({
      id: `center_to_${id}`,
      source: 'center',
      target: id,
      animated: selectedNode?.id === job.id,
      style: { stroke: '#3b82f6', strokeWidth: 1.6 },
    });
  });

  result.labRecommendations.forEach((lab, index) => {
    const id = `lab_${lab.id}`;

    nodes.push({
      id,
      type: 'lab',
      position: { x: LAB_X, y: labPositions[index] },
      data: {
        ...lab,
        onSelect: () => onSelectNode({ type: 'lab', ...lab }),
      },
      draggable: false,
      selected: selectedNode?.id === lab.id,
    });

    edges.push({
      id: `center_to_${id}`,
      source: 'center',
      target: id,
      animated: selectedNode?.id === lab.id,
      style: { stroke: '#8b5cf6', strokeWidth: 1.6 },
    });
  });

  return { nodes, edges };
}

export default function CareerMindMap({ result, selectedNode, onSelectNode }) {
  const graph = useMemo(
    () => buildGraph(result, selectedNode, onSelectNode),
    [result, selectedNode, onSelectNode]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(graph.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(graph.edges);

  useEffect(() => {
    setNodes(graph.nodes);
    setEdges(graph.edges);
  }, [graph, setEdges, setNodes]);

  if (!result) {
    return (
      <div className="flex h-full min-h-[36rem] flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="flex h-18 w-18 items-center justify-center rounded-full border border-slate-700 bg-slate-900/70 text-3xl text-slate-500">
          +
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-slate-300">No graph yet</p>
          <p className="text-sm text-slate-500">
            Upload a resume or generate a sample to render the career map.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.18, minZoom: 0.45 }}
        minZoom={0.4}
        maxZoom={1.35}
        nodesConnectable={false}
        nodesDraggable={false}
        elementsSelectable
        panOnDrag
        style={{ background: 'transparent' }}
      >
        <Background color="#1e293b" gap={20} size={1} />
        <Controls
          showInteractive={false}
          style={{
            background: 'rgba(15,23,42,0.92)',
            border: '1px solid rgba(51,65,85,0.9)',
            borderRadius: 14,
            boxShadow: '0 16px 32px rgba(2,6,23,0.28)',
          }}
        />
      </ReactFlow>

      <div className="pointer-events-none absolute bottom-4 left-4 flex flex-wrap gap-3 rounded-full border border-slate-800 bg-slate-950/75 px-3 py-2 text-[11px] text-slate-400 backdrop-blur">
        <div className="flex items-center gap-1.5">
          <div className="h-0.5 w-4 bg-blue-500" />
          <span>Career path</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-0.5 w-4 bg-purple-500" />
          <span>Lab recommendation</span>
        </div>
      </div>
    </div>
  );
}
