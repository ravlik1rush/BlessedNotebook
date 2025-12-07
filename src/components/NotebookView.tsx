import { useState, useRef, useEffect } from 'react';
import { Plus, Users, BookOpen, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Notebook } from '@/hooks/useNotebooks';
import { ProgressBar } from './ProgressBar';
import { NoteCard } from './NoteCard';
import { SortableNoteCard } from './SortableNoteCard';
import { MembersPanel } from './MembersPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import Masonry from 'react-masonry-css';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable';

interface NotebookViewProps {
  notebook: Notebook | null;
  currentUserId: string;
  onAddNote: (notebookId: string, title: string) => void;
  onRenameNote: (notebookId: string, noteId: string, title: string) => void;
  onDeleteNote: (notebookId: string, noteId: string) => void;
  onAddTask: (notebookId: string, noteId: string, title: string, folderId?: string | null) => void;
  onRenameTask: (notebookId: string, noteId: string, taskId: string, title: string) => void;
  onDeleteTask: (notebookId: string, noteId: string, taskId: string) => void;
  onToggleTask: (notebookId: string, noteId: string, taskId: string) => void;
  onAddFolder: (noteId: string, title: string) => void;
  onRenameFolder: (folderId: string, title: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onToggleFolderCollapse: (folderId: string, isCollapsed: boolean) => void;
  onReorderNotes: (notebookId: string, newOrder: { id: string; order_index: number }[]) => void;
  onReorderTasks: (noteId: string, newOrder: { id: string; order_index: number }[]) => void;
  onMoveTaskToFolder: (taskId: string, folderId: string | null) => void;
  onRefetch: () => void;
}

type UserRole = 'owner' | 'admin' | 'reader';

function calculateProgress(notebook: Notebook, userId: string) {
  const allTasks = notebook.notes.flatMap(note => note.tasks);
  const total = allTasks.length;
  if (total === 0) return { completed: 0, total: 0, percentage: 0 };
  const completed = allTasks.filter(task => task.completedBy.includes(userId)).length;
  return {
    completed,
    total,
    percentage: Math.round((completed / total) * 100),
  };
}

function calculateGroupAverage(notebook: Notebook) {
  // This is simplified - in reality we'd need all member IDs
  // For now, calculate based on unique completers
  const allTasks = notebook.notes.flatMap(note => note.tasks);
  const total = allTasks.length;
  if (total === 0 || notebook.memberCount === 0) return { completed: 0, total: 0, percentage: 0 };
  
  // Count total completions across all users
  const totalCompletions = allTasks.reduce((sum, task) => sum + task.completedBy.length, 0);
  const avgPercentage = Math.round((totalCompletions / (total * notebook.memberCount)) * 100);
  
  return {
    completed: 0,
    total: 0,
    percentage: avgPercentage,
  };
}

export function NotebookView({
  notebook,
  currentUserId,
  onAddNote,
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
  onReorderNotes,
  onReorderTasks,
  onMoveTaskToFolder,
  onRefetch,
}: NotebookViewProps) {
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const isOwner = notebook?.owner_id === currentUserId;
  const userRole = notebook?.userRole || (isOwner ? 'owner' : 'reader');
  const canEdit = userRole === 'owner' || userRole === 'admin';

  useEffect(() => {
    if (isAddingNote && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isAddingNote]);

  const handleAddNote = () => {
    if (newNoteTitle.trim() && notebook) {
      onAddNote(notebook.id, newNoteTitle.trim());
      setNewNoteTitle('');
      setIsAddingNote(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddNote();
    } else if (e.key === 'Escape') {
      setIsAddingNote(false);
      setNewNoteTitle('');
    }
  };

  const getRoleBadgeVariant = (role: UserRole) => {
    switch (role) {
      case 'owner':
        return 'bg-role-owner/10 text-role-owner border-role-owner/20';
      case 'admin':
        return 'bg-role-admin/10 text-role-admin border-role-admin/20';
      case 'reader':
        return 'bg-role-reader/10 text-role-reader border-role-reader/20';
    }
  };

  if (!notebook) {
    return (
      <main className="flex-1 flex items-center justify-center bg-background y2k-pattern">
        <div className="text-center">
          <BookOpen className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">
            Select a notebook (´･ω･`)
          </h2>
          <p className="text-muted-foreground">
            Choose a notebook from the sidebar to view its contents ⋆˚࿔
          </p>
        </div>
      </main>
    );
  }

  const myProgress = calculateProgress(notebook, currentUserId);
  const groupProgress = notebook.is_shared ? calculateGroupAverage(notebook) : null;

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = notebook.notes.findIndex((n) => n.id === active.id);
      const newIndex = notebook.notes.findIndex((n) => n.id === over.id);

      const newOrder = arrayMove(notebook.notes, oldIndex, newIndex).map((note, index) => ({
        id: note.id,
        order_index: index,
      }));

      onReorderNotes(notebook.id, newOrder);
    }
  };

  return (
    <main className="flex-1 h-screen overflow-hidden bg-background y2k-pattern flex flex-col">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">{notebook.title}</h1>
              <Badge 
                variant="outline" 
                className={cn('capitalize', getRoleBadgeVariant(userRole))}
              >
                {userRole}
              </Badge>
               {notebook.is_shared ? (
                 <MembersPanel
                   notebookId={notebook.id}
                   isOwner={isOwner}
                   shareCode={notebook.share_code}
                   onShareCodeGenerated={onRefetch}
                   onMakePrivate={onRefetch}
                 >
                   <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
                     <Users className="w-4 h-4" />
                     <span>{notebook.memberCount} {notebook.memberCount === 1 ? 'member' : 'members'}</span>
                   </button>
                 </MembersPanel>
               ) : (
                 isOwner && (
                   <MembersPanel
                     notebookId={notebook.id}
                     isOwner={isOwner}
                     shareCode={notebook.share_code}
                     onShareCodeGenerated={onRefetch}
                     onMakePrivate={onRefetch}
                   >
                     <Button variant="outline" size="sm">
                       <Users className="w-4 h-4 mr-1" />
                       Share
                     </Button>
                   </MembersPanel>
                 )
               )}
            </div>
            
            {canEdit && (
              <Button onClick={() => setIsAddingNote(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Note
              </Button>
            )}
          </div>

          {/* Progress Overview */}
          <div className="flex items-center gap-6">
            <div className="flex-1 max-w-md">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-foreground">Your Progress</span>
                <span className="text-sm text-muted-foreground">
                  {myProgress.completed}/{myProgress.total} tasks
                </span>
              </div>
              <ProgressBar percentage={myProgress.percentage} size="lg" showLabel />
            </div>
            
            {groupProgress && (
              <div className="flex-1 max-w-md">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">Group Average</span>
                </div>
                <ProgressBar percentage={groupProgress.percentage} size="lg" showLabel />
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Notes Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {isAddingNote && (
          <div className="mb-6 p-4 bg-card rounded-xl border border-border animate-fade-in">
            <h3 className="font-semibold mb-3">New Note</h3>
            <div className="flex items-center gap-3">
              <Input
                ref={inputRef}
                type="text"
                placeholder="Note name..."
                value={newNoteTitle}
                onChange={(e) => setNewNoteTitle(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1"
              />
              <Button onClick={handleAddNote}>Create</Button>
              <Button 
                variant="ghost" 
                onClick={() => {
                  setIsAddingNote(false);
                  setNewNoteTitle('');
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {notebook.notes.length === 0 && !isAddingNote ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-muted flex items-center justify-center">
              <BookOpen className="w-10 h-10 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">
              No notes yet
            </h2>
            <p className="text-muted-foreground mb-6">
              Create your first note to start tracking progress
            </p>
            {canEdit && (
              <Button onClick={() => setIsAddingNote(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add your first note
              </Button>
            )}
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={notebook.notes.map(n => n.id)}
              strategy={rectSortingStrategy}
            >
              <Masonry
                breakpointCols={{
                  default: 4,
                  1100: 3,
                  700: 2,
                  500: 1,
                }}
                className="masonry-grid"
                columnClassName="masonry-grid_column"
              >
                {notebook.notes.map((note, index) => (
                  <SortableNoteCard key={note.id} note={note} index={index}>
                    <NoteCard
                      note={note}
                      notebookId={notebook.id}
                      canEdit={canEdit}
                      isShared={notebook.is_shared}
                      currentUserId={currentUserId}
                      index={index}
                      onRenameNote={onRenameNote}
                      onDeleteNote={onDeleteNote}
                      onAddTask={onAddTask}
                      onRenameTask={onRenameTask}
                      onDeleteTask={onDeleteTask}
                      onToggleTask={onToggleTask}
                      onAddFolder={onAddFolder}
                      onRenameFolder={onRenameFolder}
                      onDeleteFolder={onDeleteFolder}
                      onToggleFolderCollapse={onToggleFolderCollapse}
                      onReorderTasks={onReorderTasks}
                      onMoveTaskToFolder={onMoveTaskToFolder}
                    />
                  </SortableNoteCard>
                ))}
              </Masonry>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </main>
  );
}
