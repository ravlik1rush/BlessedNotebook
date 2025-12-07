import { useState } from 'react';
import { ChevronDown, ChevronRight, MoreHorizontal, Pencil, Trash2, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TaskFolder as TaskFolderType, Task } from '@/hooks/useNotebooks';
import { TaskItem } from './TaskItem';
import { SortableTaskItem } from './SortableTaskItem';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDroppable } from '@dnd-kit/core';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface TaskFolderProps {
  folder: TaskFolderType;
  tasks: Task[];
  notebookId: string;
  noteId: string;
  canEdit: boolean;
  isShared: boolean;
  currentUserId: string;
  onRenameFolder: (folderId: string, title: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onToggleCollapse: (folderId: string, isCollapsed: boolean) => void;
  onRenameTask: (notebookId: string, noteId: string, taskId: string, title: string) => void;
  onDeleteTask: (notebookId: string, noteId: string, taskId: string) => void;
  onToggleTask: (notebookId: string, noteId: string, taskId: string) => void;
  onAddTask: (notebookId: string, noteId: string, title: string, folderId: string | null) => void;
  onMoveTaskToFolder: (taskId: string, folderId: string | null) => void;
}

export function TaskFolder({
  folder,
  tasks,
  notebookId,
  noteId,
  canEdit,
  isShared,
  currentUserId,
  onRenameFolder,
  onDeleteFolder,
  onToggleCollapse,
  onRenameTask,
  onDeleteTask,
  onToggleTask,
  onAddTask,
}: TaskFolderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(folder.title);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  const folderTasks = tasks.filter(t => t.folder_id === folder.id);

  const handleRename = () => {
    if (editTitle.trim() && editTitle !== folder.title) {
      onRenameFolder(folder.id, editTitle.trim());
    }
    setIsEditing(false);
  };

  const handleAddTask = () => {
    if (newTaskTitle.trim()) {
      onAddTask(notebookId, noteId, newTaskTitle.trim(), folder.id);
      setNewTaskTitle('');
      setIsAddingTask(false);
    }
  };

  const { setNodeRef, isOver } = useDroppable({
    id: folder.id,
  });

  return (
    <div 
      ref={setNodeRef}
      className={cn(
        "mb-1.5 group",
        isOver && "ring-2 ring-primary/50 rounded-lg"
      )}
    >
      {/* Folder Header */}
      <div className="flex items-center gap-1.5 px-1 py-0.5 hover:bg-muted/30 rounded transition-colors">
        <button
          onClick={() => onToggleCollapse(folder.id, !folder.is_collapsed)}
          className="p-0.5 hover:bg-muted/50 rounded transition-colors"
        >
          {folder.is_collapsed ? (
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/60" />
          )}
        </button>
        {isEditing ? (
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRename();
              else if (e.key === 'Escape') {
                setEditTitle(folder.title);
                setIsEditing(false);
              }
            }}
            className="flex-1 bg-transparent border-b border-primary outline-none text-xs text-muted-foreground/70"
            autoFocus
          />
        ) : (
          <span className="flex-1 text-xs text-muted-foreground/70 font-normal">{folder.title}</span>
        )}
        {canEdit && !isEditing && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-0.5 hover:bg-muted/50 rounded transition-colors opacity-0 group-hover:opacity-100">
                <MoreHorizontal className="w-3.5 h-3.5 text-muted-foreground/60" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setIsEditing(true)}>
                <Pencil className="w-4 h-4 mr-2" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => onDeleteFolder(folder.id)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Folder Tasks */}
      {!folder.is_collapsed && (
        <div className="pl-4 pr-1 py-1 space-y-1 min-h-[40px]">
          {folderTasks.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-2 px-2">
              No tasks in folder
            </p>
          ) : (
            folderTasks.map(task => (
              <SortableTaskItem key={task.id} task={task}>
                <TaskItem
                  task={task}
                  notebookId={notebookId}
                  noteId={noteId}
                  canEdit={canEdit}
                  isShared={isShared}
                  currentUserId={currentUserId}
                  onRenameTask={onRenameTask}
                  onDeleteTask={onDeleteTask}
                  onToggleTask={onToggleTask}
                />
              </SortableTaskItem>
            ))
          )}

          {/* Add Task to Folder */}
          {canEdit && (
            <div className="pt-1 border-t border-border/50">
              {isAddingTask ? (
                <div className="flex items-center gap-1 px-2 py-1">
                  <Input
                    type="text"
                    placeholder="Task name..."
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddTask();
                      else if (e.key === 'Escape') {
                        setNewTaskTitle('');
                        setIsAddingTask(false);
                      }
                    }}
                    className="h-7 text-xs"
                    autoFocus
                  />
                  <Button size="sm" onClick={handleAddTask} className="h-7 text-xs px-2">
                    Add
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={() => {
                      setIsAddingTask(false);
                      setNewTaskTitle('');
                    }}
                    className="h-7 text-xs px-2"
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <button
                  onClick={() => setIsAddingTask(true)}
                  className="flex items-center gap-1 w-full px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  Add task
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

