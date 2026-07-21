import { useState } from 'react'
import { File, Folder, FolderOpen } from 'lucide-react'

function TreeNode({ node, onFileClick, depth = 0 }) {
  const [open, setOpen] = useState(true)

  if (node.type === 'file') {
    return (
      <button
        type="button"
        onClick={() => onFileClick(node.path)}
        className="group flex items-center gap-2.5 w-full py-1.5 px-2 rounded-md hover:bg-surface text-left transition-colors"
      >
        <File
          size={16}
          strokeWidth={1.75}
          className="shrink-0 text-content-muted group-hover:text-brand-400 transition-colors"
        />
        <span className="truncate text-[13px] text-content-secondary group-hover:text-content-primary transition-colors">
          {node.name}
        </span>
      </button>
    )
  }

  const Icon = open ? FolderOpen : Folder

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="group flex items-center gap-2.5 w-full py-1.5 px-2 rounded-md hover:bg-surface text-left transition-colors"
      >
        <Icon
          size={16}
          strokeWidth={1.75}
          className="shrink-0 text-content-secondary group-hover:text-brand-400 transition-colors"
        />
        <span className="truncate text-[13px] font-medium text-content-primary">
          {node.name}
        </span>
      </button>

      {open && node.children && (
        // Indent guide: a thin vertical connector aligned under the folder icon.
        <div className="ml-[15px] pl-3 border-l border-edge-subtle">
          {node.children.map((child, i) => (
            <TreeNode key={i} node={child} onFileClick={onFileClick} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function FileTree({ tree, onFileClick }) {
  if (!tree || tree.length === 0) {
    return <p className="text-content-faint text-xs p-4">No file tree available</p>
  }
  return (
    <div className="select-none">
      {tree.map((node, i) => (
        <TreeNode key={i} node={node} onFileClick={onFileClick} />
      ))}
    </div>
  )
}
