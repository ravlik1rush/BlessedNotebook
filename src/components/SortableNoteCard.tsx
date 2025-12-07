import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import { GripVertical } from 'lucide-react';
import type { Note } from '@/hooks/useNotebooks';

interface SortableNoteCardProps {
  note: Note;
  index: number;
  children: React.ReactNode;
}

export function SortableNoteCard({
  note,
  index,
  children,
}: SortableNoteCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: note.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'relative group/note',
        isDragging && 'z-50'
      )}
    >
      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-10 flex items-center justify-center cursor-grab active:cursor-grabbing opacity-0 group-hover/note:opacity-100 hover:opacity-100 hover:bg-muted/50 rounded transition-opacity z-10 touch-none"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        title="Drag to reorder"
      >
        <GripVertical className="w-4 h-4 text-muted-foreground" />
      </div>
      {children}
    </div>
  );
}

