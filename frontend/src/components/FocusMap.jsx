import { useEffect, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "@dagrejs/dagre";
import EmptyState from "./ui/EmptyState";
import {
  User,
  Globe,
  Settings2,
  Code2,
  Cog,
  Sparkles,
  Database,
  CheckCircle2,
  Map as MapIcon,
} from "lucide-react";

// --- Node type styling: each execution-flow type gets a distinct appearance ---
const TYPE_STYLE = {
  user_action:        { icon: User,         color: "#94a3b8", bg: "#11161f", ring: "#334155", tag: "User Action" },
  api_endpoint:       { icon: Globe,        color: "#60a5fa", bg: "#0b1626", ring: "#1e3a5f", tag: "API Endpoint" },
  controller:         { icon: Settings2,    color: "#a78bfa", bg: "#15112a", ring: "#4c3a8a", tag: "Controller" },
  function:           { icon: Code2,        color: "#818cf8", bg: "#13142b", ring: "#3730a3", tag: "Function" },
  background_process: { icon: Cog,          color: "#fbbf24", bg: "#211a0d", ring: "#78540f", tag: "Process" },
  ai_service:         { icon: Sparkles,     color: "#e879f9", bg: "#22102a", ring: "#86198f", tag: "AI Service" },
  database:           { icon: Database,     color: "#2dd4bf", bg: "#0c211e", ring: "#155e54", tag: "Storage" },
  output:             { icon: CheckCircle2, color: "#34d399", bg: "#0c2018", ring: "#15543f", tag: "Output" },
};

const NODE_W = 230;
const NODE_H = 66;

function FlowNode({ data, selected }) {
  const style = TYPE_STYLE[data.execType] || TYPE_STYLE.function;
  const Icon = style.icon;
  const clickable = Boolean(data.file);

  return (
    <div
      style={{
        width: NODE_W,
        background: style.bg,
        borderColor: selected ? style.color : style.ring,
      }}
      className={`rounded-xl border px-3 py-2 shadow-lg transition-all ${
        clickable ? "cursor-pointer hover:brightness-125" : "cursor-default"
      } ${selected ? "ring-2" : ""}`}
    >
      <Handle type="target" position={Position.Top} className="!bg-edge-strong !w-2 !h-2 !border-0" />

      <div className="flex items-center gap-2">
        <Icon size={15} style={{ color: style.color }} className="shrink-0" />
        <span className="text-xs font-medium text-content-primary leading-snug line-clamp-2">
          {data.label}
        </span>
      </div>

      <div className="flex items-center justify-between mt-1.5 gap-2">
        <span
          style={{ color: style.color }}
          className="text-[9px] uppercase tracking-wider opacity-70 shrink-0"
        >
          {style.tag}
        </span>
        {data.file && (
          <span className="text-[9px] text-content-muted font-mono truncate">
            {data.file.split("/").pop()}
          </span>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-edge-strong !w-2 !h-2 !border-0" />
    </div>
  );
}

const nodeTypes = { flow: FlowNode };

// --- Dagre auto-layout: turns the structured flow into a workflow diagram ---
function layoutGraph(flowNodes, flowEdges) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: 45, ranksep: 70, marginx: 20, marginy: 20 });

  const ids = new Set(flowNodes.map((n) => n.id));
  flowNodes.forEach((n) => g.setNode(n.id, { width: NODE_W, height: NODE_H }));
  // only edges whose endpoints both exist (defensive — no phantom nodes)
  const validEdges = flowEdges.filter((e) => ids.has(e.source) && ids.has(e.target));
  validEdges.forEach((e) => g.setEdge(e.source, e.target));

  dagre.layout(g);

  const nodes = flowNodes.map((n) => {
    const pos = g.node(n.id);
    return {
      id: n.id,
      type: "flow",
      position: { x: pos.x - NODE_W / 2, y: pos.y - NODE_H / 2 },
      data: {
        label: n.label,
        execType: n.type,
        file: n.file || null,
        functionName: n.functionName || null,
        startLine: n.startLine ?? null,
        endLine: n.endLine ?? null,
      },
    };
  });

  const edges = validEdges.map((e, i) => ({
    id: `e-${e.source}-${e.target}-${i}`,
    source: e.source,
    target: e.target,
    label: e.label || undefined,
    type: "smoothstep",
    animated: true,
    style: { stroke: "#6366f1", strokeWidth: 1.5, opacity: 0.6 },
    labelStyle: { fill: "#818cf8", fontSize: 9 },
    labelBgStyle: { fill: "#0d0d1a", fillOpacity: 0.9 },
    labelBgPadding: [4, 2],
  }));

  return { nodes, edges };
}

// Distinct legend swatches for the node types present in the current flow.
function Legend({ types }) {
  if (!types.length) return null;
  return (
    <div className="absolute bottom-3 left-3 z-10 bg-surface/90 backdrop-blur-sm border border-edge-subtle rounded-lg px-2.5 py-2 space-y-1 max-w-[150px]">
      {types.map((t) => {
        const s = TYPE_STYLE[t];
        if (!s) return null;
        const Icon = s.icon;
        return (
          <div key={t} className="flex items-center gap-1.5">
            <Icon size={11} style={{ color: s.color }} />
            <span className="text-[9px] text-content-secondary">{s.tag}</span>
          </div>
        );
      })}
    </div>
  );
}

function FocusMapInner({ data, onOpenNode }) {
  const { fitView } = useReactFlow();

  const graph = useMemo(
    () => layoutGraph(data.nodes, data.edges || []),
    [data]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(graph.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(graph.edges);

  const legendTypes = useMemo(() => {
    const present = [];
    const seen = new Set();
    (data.nodes || []).forEach((n) => {
      if (!seen.has(n.type) && TYPE_STYLE[n.type]) {
        seen.add(n.type);
        present.push(n.type);
      }
    });
    return present;
  }, [data]);

  // Re-layout + smoothly recenter whenever a new flow arrives.
  useEffect(() => {
    setNodes(graph.nodes);
    setEdges(graph.edges);
    const t = setTimeout(() => fitView({ duration: 500, padding: 0.18 }), 60);
    return () => clearTimeout(t);
  }, [graph, setNodes, setEdges, fitView]);

  return (
    <div className="h-full w-full relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={(_, node) => {
          if (node.data.file) onOpenNode?.(node.data);
        }}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.18 }}
        minZoom={0.15}
        maxZoom={1.6}
        proOptions={{ hideAttribution: true }}
        className="bg-base"
      >
        <Background color="#1E1E2A" gap={20} />
        <Controls className="!bg-surface !border !border-edge-subtle [&_button]:!bg-surface [&_button]:!border-edge-subtle [&_button]:!fill-content-secondary [&_button:hover]:!bg-surface-raised" />
        <MiniMap
          pannable
          zoomable
          nodeColor={(n) => (TYPE_STYLE[n.data?.execType] || TYPE_STYLE.function).color}
          maskColor="rgba(11,11,15,0.7)"
          className="!bg-surface !border !border-edge-subtle"
          style={{ width: 110, height: 80 }}
        />
      </ReactFlow>

      <p className="absolute top-3 left-3 text-content-muted text-xs pointer-events-none z-10">
        Execution flow · click a code node to inspect it
      </p>
      <Legend types={legendTypes} />
    </div>
  );
}

export default function FocusMap({ data, onOpenNode }) {
  if (!data || !data.nodes || data.nodes.length === 0) {
    return (
      <EmptyState icon={MapIcon}>
        <p>Ask a question and click</p>
        <p className="text-brand-400 font-medium">"View Execution Flow →"</p>
        <p>to see how the code runs</p>
      </EmptyState>
    );
  }

  return (
    <ReactFlowProvider>
      <FocusMapInner data={data} onOpenNode={onOpenNode} />
    </ReactFlowProvider>
  );
}
