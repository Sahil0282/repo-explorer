import { useState } from 'react'

function TreeNode({ node, onFileClick }) {
  const [open, setOpen] = useState(true)

  if (node.type === 'file') {
    return (
      <div
        onClick={() => onFileClick(node.path)}
        className="flex items-center gap-2 py-0.5 px-2 hover:bg-[#111] rounded text-[#888] hover:text-[#818cf8] text-xs cursor-pointer transition-colors"
      >
        <span>📄</span>
        <span>{node.name}</span>
      </div>
    )
  }

  return (
    <div>
      <div
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 py-0.5 px-2 hover:bg-[#111] rounded text-[#666] hover:text-white text-xs cursor-pointer"
      >
        <span>{open ? '▾' : '▸'}</span>
        <span>📁</span>
        <span>{node.name}</span>
      </div>
      {open && node.children && (
        <div className="ml-4">
          {node.children.map((child, i) => (
            <TreeNode key={i} node={child} onFileClick={onFileClick} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function FileTree({ tree, onFileClick }) {
  if (!tree || tree.length === 0) {
    return <p className="text-[#444] text-xs p-4">No file tree available</p>
  }
  return (
    <div className="font-mono">
      {tree.map((node, i) => (
        <TreeNode key={i} node={node} onFileClick={onFileClick} />
      ))}
    </div>
  )
}