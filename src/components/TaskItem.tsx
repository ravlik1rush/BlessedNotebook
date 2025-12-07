import { useState, useRef, useEffect } from 'react';
import { Check, MoreHorizontal, Pencil, Trash2, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Task } from '@/hooks/useNotebooks';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

interface TaskItemProps {
  task: Task;
  notebookId: string;
  noteId: string;
  canEdit: boolean;
  isShared: boolean;
  currentUserId: string;
  onRenameTask: (notebookId: string, noteId: string, taskId: string, title: string) => void;
  onDeleteTask: (notebookId: string, noteId: string, taskId: string) => void;
  onToggleTask: (notebookId: string, noteId: string, taskId: string) => void;
}

export function TaskItem({ 
  task, 
  notebookId, 
  noteId, 
  canEdit, 
  isShared,
  currentUserId,
  onRenameTask,
  onDeleteTask,
  onToggleTask,
}: TaskItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const inputRef = useRef<HTMLInputElement>(null);

  const isCompletedByMe = task.completedBy.includes(currentUserId);
  const completedCount = task.completedBy.length;

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleToggle = () => {
    onToggleTask(notebookId, noteId, task.id);
  };

  const handleRename = () => {
    if (editTitle.trim() && editTitle !== task.title) {
      onRenameTask(notebookId, noteId, task.id, editTitle.trim());
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRename();
    } else if (e.key === 'Escape') {
      setEditTitle(task.title);
      setIsEditing(false);
    }
  };

  return (
    <div className={cn(
      'group flex items-center gap-3 p-2 rounded-lg transition-all duration-200',
      'hover:bg-muted/50',
      isCompletedByMe && 'opacity-75'
    )}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleToggle();
        }}
        onMouseDown={(e) => e.stopPropagation()}
        className={cn(
          'flex-shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-200',
          isCompletedByMe
            ? 'bg-primary border-primary'
            : 'border-muted-foreground/30 hover:border-primary/50'
        )}
      >
        {isCompletedByMe && (
          <Check className="w-3 h-3 text-primary-foreground animate-check-bounce" />
        )}
      </button>

      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onBlur={handleRename}
          onKeyDown={handleKeyDown}
          className="flex-1 bg-transparent border-b border-primary outline-none text-sm py-0.5"
        />
      ) : (
        <span className={cn(
          'flex-1 text-sm transition-all duration-200',
          isCompletedByMe && 'line-through text-muted-foreground'
        )}>
          {task.title}
        </span>
      )}

      {isShared && completedCount > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1 text-xs text-muted-foreground cursor-default">
              <Users className="w-3 h-3" />
              <span>{completedCount}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <p className="font-medium mb-2">Completed by:</p>
            <ScrollArea className="max-h-32">
              <ul className="space-y-2">
                {task.completions.map((completion) => (
                  <li key={completion.userId} className="flex items-center gap-2 text-sm">
                    <Avatar className="w-6 h-6">
                      <AvatarImage src={completion.avatarUrl || undefined} alt={completion.userName} />
                      <AvatarFallback className="text-xs">
                        {completion.userName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="flex-1">
                      {completion.userName}
                      {completion.userId === currentUserId && (
                        <span className="text-muted-foreground ml-1">(you)</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </TooltipContent>
        </Tooltip>
      )}

      {canEdit && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button 
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-muted rounded transition-all"
            >
              <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setIsEditing(true)}>
              <Pencil className="w-4 h-4 mr-2" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => onDeleteTask(notebookId, noteId, task.id)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
