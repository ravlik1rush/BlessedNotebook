import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import type { Task } from '@/hooks/useNotebooks';

interface SortableTaskItemProps {
  task: Task;
  children: React.ReactNode;
}

export function SortableTaskItem({
  task,
  children,
}: SortableTaskItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative group/task"
    >
      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-6 flex items-center justify-center cursor-grab active:cursor-grabbing opacity-0 group-hover/task:opacity-100 hover:bg-muted/50 rounded transition-opacity z-10 touch-none"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="w-3 h-3 text-muted-foreground/60" />
      </div>
      <div className={isDragging ? 'opacity-50' : ''}>
        {children}
      </div>
    </div>
  );
}

