import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import type { Notebook } from '@/hooks/useNotebooks';

interface SortableNotebookItemProps {
  notebook: Notebook;
  isSelected: boolean;
  isEditing: boolean;
  isOwner: boolean;
  currentUserId: string;
  children: React.ReactNode;
}

export function SortableNotebookItem({
  notebook,
  isSelected,
  isEditing,
  isOwner,
  currentUserId,
  children,
}: SortableNotebookItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: notebook.id, disabled: isEditing });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...(!isEditing ? listeners : {})}
      className={cn(
        'group rounded-lg transition-all duration-200 animate-slide-in',
        isSelected ? 'bg-sidebar-accent' : 'hover:bg-sidebar-accent/50',
        isDragging && 'z-50'
      )}
    >
      {children}
    </div>
  );
}

