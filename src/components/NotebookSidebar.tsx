import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Book, 
  Users, 
  MoreHorizontal, 
  Pencil, 
  Trash2,
  ChevronRight,
  Notebook as NotebookIcon,
  LogOut,
  Link2,
  Camera
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import type { Notebook } from '@/hooks/useNotebooks';
import { toast } from 'sonner';
import { ProgressBar } from './ProgressBar';
import { JoinNotebookDialog } from './JoinNotebookDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface NotebookSidebarProps {
  notebooks: Notebook[];
  selectedNotebookId: string | null;
  onSelectNotebook: (id: string | null) => void;
  onAddNotebook: (title: string) => void;
  onRenameNotebook: (id: string, title: string) => void;
  onDeleteNotebook: (id: string) => void;
  currentUserId: string;
  currentUserName: string;
  currentUserEmail: string;
  currentUserAvatar: string | null;
  onRefetch: () => void;
}

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

export function NotebookSidebar({
  notebooks,
  selectedNotebookId,
  onSelectNotebook,
  onAddNotebook,
  onRenameNotebook,
  onDeleteNotebook,
  currentUserId,
  currentUserName,
  currentUserEmail,
  currentUserAvatar,
  onRefetch,
}: NotebookSidebarProps) {
  const { signOut, updateAvatar, refetchProfile } = useAuth();
  const navigate = useNavigate();
  const [isAdding, setIsAdding] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newTitle, setNewTitle] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAdding && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isAdding]);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const handleAdd = () => {
    if (newTitle.trim()) {
      onAddNotebook(newTitle.trim());
      setNewTitle('');
      setIsAdding(false);
    }
  };

  const handleRename = (id: string) => {
    if (editTitle.trim()) {
      onRenameNotebook(id, editTitle.trim());
    }
    setEditingId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAdd();
    } else if (e.key === 'Escape') {
      setIsAdding(false);
      setNewTitle('');
    }
  };

  const handleEditKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter') {
      handleRename(id);
    } else if (e.key === 'Escape') {
      setEditingId(null);
    }
  };

  const notebookToDelete = notebooks.find(nb => nb.id === deleteId);

  return (
    <aside className="w-[280px] h-screen bg-sidebar flex flex-col border-r border-sidebar-border shadow-sm">
      {/* Header */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sidebar-primary/20 flex items-center justify-center">
            <NotebookIcon className="w-5 h-5 text-sidebar-primary" />
          </div>
          <div>
            <h1 className="font-bold text-sidebar-foreground">EchoTasks <span className="text-sm"></span></h1>
            <p className="text-xs text-sidebar-muted">Track your goals ⋆˚࿔</p>
          </div>
        </div>
      </div>

      {/* Notebooks List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-2">
        <div className="flex items-center justify-between px-2 py-2">
          <span className="text-xs font-semibold text-sidebar-muted uppercase tracking-wider">
            Notebooks
          </span>
          <div className="flex items-center gap-1">
            <JoinNotebookDialog onJoined={onRefetch}>
              <button className="p-1 rounded hover:bg-sidebar-accent transition-colors">
                <Link2 className="w-4 h-4 text-sidebar-muted" />
              </button>
            </JoinNotebookDialog>
            <button
              onClick={() => setIsAdding(true)}
              className="p-1 rounded hover:bg-sidebar-accent transition-colors"
            >
              <Plus className="w-4 h-4 text-sidebar-muted" />
            </button>
          </div>
        </div>

        {isAdding && (
          <div className="px-2 py-1 animate-fade-in">
            <div className="flex items-center gap-2 bg-sidebar-accent rounded-lg p-2">
              <Book className="w-4 h-4 text-sidebar-muted flex-shrink-0" />
              <Input
                ref={inputRef}
                type="text"
                placeholder="Notebook name..."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={() => {
                  if (!newTitle.trim()) setIsAdding(false);
                }}
                className="h-7 text-sm bg-transparent border-0 focus-visible:ring-0 px-0 text-sidebar-foreground placeholder:text-sidebar-muted"
              />
            </div>
          </div>
        )}

        <div className="space-y-1">
          {notebooks.map((notebook, index) => {
            const progress = calculateProgress(notebook, currentUserId);
            const isSelected = notebook.id === selectedNotebookId;
            const isEditing = notebook.id === editingId;
            const isOwner = notebook.owner_id === currentUserId;

            return (
              <div
                key={notebook.id}
                className={cn(
                  'group rounded-lg transition-all duration-200 animate-slide-in',
                  isSelected ? 'bg-sidebar-accent' : 'hover:bg-sidebar-accent/50'
                )}
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <button
                  onClick={() => !isEditing && onSelectNotebook(notebook.id)}
                  className="w-full p-2 text-left"
                >
                  <div className="flex items-center gap-2">
                    <ChevronRight className={cn(
                      'w-4 h-4 text-sidebar-muted transition-transform',
                      isSelected && 'rotate-90'
                    )} />
                    <Book className={cn(
                      'w-4 h-4 flex-shrink-0',
                      isSelected ? 'text-sidebar-primary' : 'text-sidebar-muted'
                    )} />
                    
                    {isEditing ? (
                      <Input
                        ref={editInputRef}
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onKeyDown={(e) => handleEditKeyDown(e, notebook.id)}
                        onBlur={() => handleRename(notebook.id)}
                        className="h-6 text-sm bg-transparent border-0 focus-visible:ring-0 px-0 text-sidebar-foreground"
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span className={cn(
                        'flex-1 text-sm font-medium truncate',
                        isSelected ? 'text-sidebar-foreground' : 'text-sidebar-foreground/80'
                      )}>
                        {notebook.title}
                      </span>
                    )}
                    
                     {notebook.is_shared && notebook.memberCount > 1 && (
                      <div className="flex items-center gap-1 text-xs text-sidebar-muted">
                        <Users className="w-3.5 h-3.5" />
                        <span>{notebook.memberCount}</span>
                      </div>
                    )}
                    
                    {isOwner && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button 
                            onClick={(e) => e.stopPropagation()}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-sidebar-border transition-all"
                          >
                            <MoreHorizontal className="w-4 h-4 text-sidebar-muted" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => {
                            setEditingId(notebook.id);
                            setEditTitle(notebook.title);
                          }}>
                            <Pencil className="w-4 h-4 mr-2" />
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => setDeleteId(notebook.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                  
                  {notebook.notes.length > 0 && (
                    <div className="mt-2 ml-6">
                      <ProgressBar 
                        percentage={progress.percentage} 
                        size="sm" 
                        showLabel 
                        className="text-sidebar-muted"
                      />
                    </div>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {notebooks.length === 0 && !isAdding && (
          <div className="text-center py-8">
            <Book className="w-12 h-12 mx-auto text-sidebar-muted/50 mb-3" />
            <p className="text-sm text-sidebar-muted">No notebooks yet (´･ω･`)</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsAdding(true)}
              className="mt-2 text-sidebar-primary hover:text-sidebar-primary rounded-full"
            >
              <Plus className="w-4 h-4 mr-1" />
              Create your first notebook ⋆˚࿔
            </Button>
          </div>
        )}
      </div>

      {/* User Info */}
      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="relative group">
            <Avatar className="w-10 h-10">
              <AvatarImage src={currentUserAvatar || undefined} alt={currentUserName} />
              <AvatarFallback className="bg-sidebar-primary/20 text-sidebar-primary text-sm font-semibold">
                {currentUserName.charAt(0).toUpperCase() || '?'}
              </AvatarFallback>
            </Avatar>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              title="Change avatar"
            >
              <Camera className="w-4 h-4 text-white" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) {
                  // Validate file size (max 5MB)
                  if (file.size > 5 * 1024 * 1024) {
                    toast.error('Image size must be less than 5MB');
                    if (fileInputRef.current) {
                      fileInputRef.current.value = '';
                    }
                    return;
                  }

                  // Validate file type
                  if (!file.type.startsWith('image/')) {
                    toast.error('Please select a valid image file');
                    if (fileInputRef.current) {
                      fileInputRef.current.value = '';
                    }
                    return;
                  }

                  const { error } = await updateAvatar(file);
                  if (error) {
                    console.error('Avatar upload error:', error);
                    toast.error(error.message || 'Failed to upload avatar. Please check if the storage bucket exists.');
                  } else {
                    await refetchProfile();
                    onRefetch();
                  }
                }
                // Reset input
                if (fileInputRef.current) {
                  fileInputRef.current.value = '';
                }
              }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">
              {currentUserName || 'User'}
            </p>
            <p className="text-xs text-sidebar-muted truncate">
              {currentUserEmail}
            </p>
          </div>
          <button
            onClick={() => setShowLogoutDialog(true)}
            className="p-2 rounded-lg hover:bg-sidebar-accent transition-colors"
            title="Log out"
          >
            <LogOut className="w-4 h-4 text-sidebar-muted" />
          </button>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete notebook?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{notebookToDelete?.title}"? 
              This will permanently delete all notes and tasks inside it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteId) onDeleteNotebook(deleteId);
                setDeleteId(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Logout Confirmation Dialog */}
      <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Log out?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to log out?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                await signOut();
                navigate('/');
              }}
            >
              Log out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  );
}
