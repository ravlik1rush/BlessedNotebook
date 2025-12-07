import { useState, useRef, useEffect } from 'react';
import { Plus, MoreHorizontal, Pencil, Trash2, RotateCcw, Folder } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Note } from '@/hooks/useNotebooks';
import { ProgressBar } from './ProgressBar';
import { TaskItem } from './TaskItem';
import { SortableTaskItem } from './SortableTaskItem';
import { TaskFolder } from './TaskFolder';
import { CreateFolderDialog } from './CreateFolderDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  useDroppable,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface NoteCardProps {
  note: Note;
  notebookId: string;
  canEdit: boolean;
  isShared: boolean;
  currentUserId: string;
  index: number;
  onRenameNote: (notebookId: string, noteId: string, title: string) => void;
  onDeleteNote: (notebookId: string, noteId: string) => void;
  onAddTask: (notebookId: string, noteId: string, title: string, folderId?: string | null) => void;
  onAddFolder: (noteId: string, title: string) => void;
  onRenameFolder: (folderId: string, title: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onToggleFolderCollapse: (folderId: string, isCollapsed: boolean) => void;
  onRenameTask: (notebookId: string, noteId: string, taskId: string, title: string) => void;
  onDeleteTask: (notebookId: string, noteId: string, taskId: string) => void;
  onToggleTask: (notebookId: string, noteId: string, taskId: string) => void;
  onReorderTasks: (noteId: string, newOrder: { id: string; order_index: number }[]) => void;
  onMoveTaskToFolder: (taskId: string, folderId: string | null) => void;
}

function calculateNoteProgress(note: Note, userId: string) {
  const total = note.tasks.length;
  if (total === 0) return { completed: 0, total: 0, percentage: 0 };
  const completed = note.tasks.filter(task => task.completedBy.includes(userId)).length;
  return {
    completed,
    total,
    percentage: Math.round((completed / total) * 100),
  };
}

export function NoteCard({ 
  note, 
  notebookId, 
  canEdit, 
  isShared, 
  currentUserId,
  index,
  onRenameNote,
  onDeleteNote,
  onAddTask,
  onRenameTask,
  onDeleteTask,
  onToggleTask,
  onAddFolder,
  onRenameFolder,
  onDeleteFolder,
  onToggleFolderCollapse,
  onReorderTasks,
  onMoveTaskToFolder,
}: NoteCardProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const { setNodeRef: setRootNodeRef, isOver: isRootOver } = useDroppable({
    id: `root-${note.id}`,
  });

  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(note.title);
  const [showFolderDialog, setShowFolderDialog] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const newTaskInputRef = useRef<HTMLInputElement>(null);

  const progress = calculateNoteProgress(note, currentUserId);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    if (isAddingTask && newTaskInputRef.current) {
      newTaskInputRef.current.focus();
    }
  }, [isAddingTask]);

  const handleRename = () => {
    if (editTitle.trim() && editTitle !== note.title) {
      onRenameNote(notebookId, note.id, editTitle.trim());
    }
    setIsEditing(false);
  };

  const handleAddTask = () => {
    if (newTaskTitle.trim()) {
      onAddTask(notebookId, note.id, newTaskTitle.trim());
      setNewTaskTitle('');
      setIsAddingTask(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRename();
    } else if (e.key === 'Escape') {
      setEditTitle(note.title);
      setIsEditing(false);
    }
  };

  const handleTaskKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddTask();
    } else if (e.key === 'Escape') {
      setNewTaskTitle('');
      setIsAddingTask(false);
    }
  };

  const handleTaskDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Check if dropping on a folder
    const targetFolder = note.folders.find(f => f.id === overId);
    if (targetFolder) {
      // Moving task to folder
      const task = note.tasks.find(t => t.id === activeId);
      if (task && task.folder_id !== targetFolder.id) {
        onMoveTaskToFolder(activeId, targetFolder.id);
      }
      return;
    }

    // Check if dropping on "root" (outside folders)
    if (overId === `root-${note.id}`) {
      const task = note.tasks.find(t => t.id === activeId);
      if (task && task.folder_id !== null) {
        onMoveTaskToFolder(activeId, null);
      }
      return;
    }

    // Reordering within same container
    const activeTask = note.tasks.find(t => t.id === activeId);
    const overTask = note.tasks.find(t => t.id === overId);
    
    if (!activeTask || !overTask) return;

    // If moving between different containers (folder <-> root), move the task
    if (activeTask.folder_id !== overTask.folder_id) {
      onMoveTaskToFolder(activeId, overTask.folder_id);
      return;
    }

    // Reordering within same container (root or folder)
    if (activeTask.folder_id === overTask.folder_id) {
      // Get tasks in the same container (root or folder)
      const tasksInContainer = activeTask.folder_id === null
        ? note.tasks.filter(t => !t.folder_id)
        : note.tasks.filter(t => t.folder_id === activeTask.folder_id);
      
      const oldIndex = tasksInContainer.findIndex((t) => t.id === activeId);
      const newIndex = tasksInContainer.findIndex((t) => t.id === overId);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(tasksInContainer, oldIndex, newIndex).map((task, index) => ({
          id: task.id,
          order_index: index,
        }));
        onReorderTasks(note.id, newOrder);
      }
    }
  };

  return (
    <div 
      className={cn(
        'bg-card rounded-xl border border-border shadow-sm overflow-hidden animate-fade-in flex flex-col',
        'hover:shadow-md transition-shadow duration-300'
      )}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Header */}
      <div className="p-4 border-b border-border flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={handleRename}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-transparent border-b border-primary outline-none font-semibold text-lg"
            />
          ) : (
            <h3 className="font-semibold text-lg text-card-foreground">{note.title}</h3>
          )}
          
          <div className="flex items-center gap-1">
            {canEdit && (
              <>
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    // Reset all tasks in this note
                    for (const task of note.tasks) {
                      if (task.completedBy.includes(currentUserId)) {
                        await onToggleTask(notebookId, note.id, task.id);
                      }
                    }
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="p-1 hover:bg-muted rounded-full transition-colors"
                  title="Reset all tasks"
                >
                  <RotateCcw className="w-4 h-4 text-muted-foreground" />
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button 
                      className="p-1 hover:bg-muted rounded transition-colors"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontal className="w-5 h-5 text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setIsEditing(true)}>
                      <Pencil className="w-4 h-4 mr-2" />
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => onDeleteNote(notebookId, note.id)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <ProgressBar percentage={progress.percentage} size="md" className="flex-1" />
          <span className="text-sm font-medium text-muted-foreground">
            {progress.completed}/{progress.total}
          </span>
        </div>
      </div>

      {/* Tasks - Scrollable area */}
      <div className="flex-1 overflow-y-auto p-2 min-h-0">
        {note.tasks.length === 0 && note.folders.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No tasks yet (´･ω･`) <span className="text-xs">Add one to get started! ⋆˚࿔</span>
          </p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleTaskDragEnd}
          >
            <div className="space-y-1">
              {/* Folders */}
              {note.folders.map(folder => (
                <TaskFolder
                  key={folder.id}
                  folder={folder}
                  tasks={note.tasks}
                  notebookId={notebookId}
                  noteId={note.id}
                  canEdit={canEdit}
                  isShared={isShared}
                  currentUserId={currentUserId}
                  onRenameFolder={onRenameFolder}
                  onDeleteFolder={onDeleteFolder}
                  onToggleCollapse={onToggleFolderCollapse}
                  onRenameTask={onRenameTask}
                  onDeleteTask={onDeleteTask}
                  onToggleTask={onToggleTask}
                  onAddTask={onAddTask}
                  onMoveTaskToFolder={onMoveTaskToFolder}
                />
              ))}
              
              {/* Drop zone for root (outside folders) */}
              <div
                ref={setRootNodeRef}
                className={cn(
                  "min-h-[40px] rounded-lg border-2 border-dashed transition-colors",
                  isRootOver 
                    ? "border-primary/50 bg-primary/5" 
                    : "border-transparent hover:border-primary/30"
                )}
              >
                <SortableContext
                  items={note.tasks.filter(t => !t.folder_id).map(t => t.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {note.tasks.filter(t => !t.folder_id).map(task => (
                    <SortableTaskItem key={task.id} task={task}>
                      <TaskItem
                        task={task}
                        notebookId={notebookId}
                        noteId={note.id}
                        canEdit={canEdit}
                        isShared={isShared}
                        currentUserId={currentUserId}
                        onRenameTask={onRenameTask}
                        onDeleteTask={onDeleteTask}
                        onToggleTask={onToggleTask}
                      />
                    </SortableTaskItem>
                  ))}
                </SortableContext>
              </div>
            </div>
          </DndContext>
        )}
      </div>

      {/* Add Task - Sticky at bottom */}
      {canEdit && (
        <div className="p-2 pt-2 border-t border-border flex-shrink-0 bg-card">
          {isAddingTask ? (
            <div className="flex items-center gap-2">
              <Input
                ref={newTaskInputRef}
                type="text"
                placeholder="Task name..."
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={handleTaskKeyDown}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                className="h-8 text-sm"
              />
              <Button 
                size="sm" 
                onClick={(e) => {
                  e.stopPropagation();
                  handleAddTask();
                }}
                onMouseDown={(e) => e.stopPropagation()}
                className="h-8"
              >
                Add
              </Button>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={(e) => {
                  e.stopPropagation();
                  setIsAddingTask(false);
                  setNewTaskTitle('');
                }}
                onMouseDown={(e) => e.stopPropagation()}
                className="h-8"
              >
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsAddingTask(true)}
                className="flex-1 flex items-center gap-2 p-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add task
              </button>
              <button
                onClick={() => setShowFolderDialog(true)}
                className="flex items-center gap-2 p-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                title="Add folder"
              >
                <Folder className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}
      <CreateFolderDialog
        open={showFolderDialog}
        onOpenChange={setShowFolderDialog}
        onConfirm={async (title) => {
          await onAddFolder(note.id, title);
        }}
      />
    </div>
  );
}
