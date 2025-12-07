import { useState, useEffect, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

export interface TaskCompletion {
  userId: string;
  userName: string;
  avatarUrl: string | null;
}

export interface Task {
  id: string;
  title: string;
  note_id: string;
  folder_id: string | null;
  order_index: number;
  created_at: string;
  completedBy: string[];
  completions: TaskCompletion[];
}

export interface TaskFolder {
  id: string;
  note_id: string;
  title: string;
  order_index: number;
  is_collapsed: boolean;
  created_at: string;
}

export interface Note {
  id: string;
  title: string;
  notebook_id: string;
  order_index: number;
  created_at: string;
  tasks: Task[];
  folders: TaskFolder[];
}

export interface Notebook {
  id: string;
  title: string;
  owner_id: string;
  is_shared: boolean;
  share_code: string | null;
  order_index: number;
  created_at: string;
  notes: Note[];
  memberCount: number;
  userRole: 'owner' | 'admin' | 'reader';
}

export function useNotebooks() {
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const fetchNotebooks = useCallback(async () => {
    if (!user) {
      setNotebooks([]);
      setLoading(false);
      return;
    }

    try {
      // Get notebooks where user is owner
      const { data: ownedNotebooks, error: ownedError } = await supabase
        .from('notebooks')
        .select('*')
        .eq('owner_id', user.id);

      if (ownedError) throw ownedError;

      // Get notebooks where user is a member
      const { data: memberNotebooks, error: memberError } = await supabase
        .from('notebook_members')
        .select('notebook_id, notebooks(*)')
        .eq('user_id', user.id);

      if (memberError) throw memberError;

      // Combine and dedupe
      const allNotebookIds = new Set<string>();
      const allNotebooks: any[] = [];

      ownedNotebooks?.forEach(nb => {
        if (!allNotebookIds.has(nb.id)) {
          allNotebookIds.add(nb.id);
          allNotebooks.push(nb);
        }
      });

      memberNotebooks?.forEach(m => {
        if (m.notebooks && !allNotebookIds.has((m.notebooks as any).id)) {
          allNotebookIds.add((m.notebooks as any).id);
          allNotebooks.push(m.notebooks);
        }
      });

      // Fetch notes and tasks for each notebook
      const notebooksWithData = await Promise.all(
        allNotebooks.map(async (nb) => {
          // Get user's role for this notebook
          let userRole: 'owner' | 'admin' | 'reader' = 'reader';
          if (nb.owner_id === user.id) {
            userRole = 'owner';
          } else {
            const { data: membership } = await supabase
              .from('notebook_members')
              .select('role')
              .eq('notebook_id', nb.id)
              .eq('user_id', user.id)
              .maybeSingle();
            if (membership) {
              userRole = membership.role as 'owner' | 'admin' | 'reader';
            }
          }

          // Get notes
          const { data: notes } = await supabase
            .from('notes')
            .select('*')
            .eq('notebook_id', nb.id)
            .order('order_index', { ascending: true });

          // Get folders for all notes
          const noteIds = notes?.map(n => n.id) || [];
          let folders: any[] = [];
          if (noteIds.length > 0) {
            const { data: folderData } = await supabase
              .from('task_folders')
              .select('*')
              .in('note_id', noteIds)
              .order('order_index', { ascending: true });
            folders = folderData || [];
          }

          // Get tasks for all notes
          let tasks: any[] = [];
          if (noteIds.length > 0) {
            const { data: taskData } = await supabase
              .from('tasks')
              .select('*')
              .in('note_id', noteIds)
              .order('order_index', { ascending: true });
            tasks = taskData || [];
          }

          // Get completions
          const taskIds = tasks.map(t => t.id);
          let completions: { task_id: string; user_id: string; userName: string; avatarUrl: string | null }[] = [];
          if (taskIds.length > 0) {
            const { data: completionData } = await supabase
              .from('task_completions')
              .select('task_id, user_id')
              .in('task_id', taskIds);
            
            if (completionData && completionData.length > 0) {
              // Get unique user IDs from completions
              const userIds = [...new Set(completionData.map(c => c.user_id))];
              
              // Fetch profiles for those users
              const { data: profiles } = await supabase
                .from('profiles')
                .select('user_id, name, avatar_url')
                .in('user_id', userIds);
              
              const profileMap = new Map(profiles?.map(p => [p.user_id, { name: p.name, avatar_url: p.avatar_url }]) || []);
              
              completions = completionData.map(c => {
                const profile = profileMap.get(c.user_id);
                return {
                  ...c,
                  userName: profile?.name || 'Unknown',
                  avatarUrl: profile?.avatar_url || null
                };
              });
            }
          }

          // Get member count
          const { count: memberCount } = await supabase
            .from('notebook_members')
            .select('*', { count: 'exact', head: true })
            .eq('notebook_id', nb.id);

          // Build tasks with completedBy and completions
          const tasksWithCompletions = tasks.map(t => {
            const taskCompletions = completions.filter(c => c.task_id === t.id);
            return {
              ...t,
              completedBy: taskCompletions.map(c => c.user_id),
              completions: taskCompletions.map(c => ({
                userId: c.user_id,
                userName: c.userName,
                avatarUrl: c.avatarUrl
              }))
            };
          });

          // Build notes with tasks and folders
          const notesWithTasks = (notes || []).map(n => {
            const noteFolders = folders.filter(f => f.note_id === n.id);
            const noteTasks = tasksWithCompletions.filter(t => t.note_id === n.id);
            return {
              ...n,
              folders: noteFolders,
              tasks: noteTasks
            };
          });

          return {
            ...nb,
            notes: notesWithTasks,
            memberCount: (memberCount || 0) + 1, // +1 for owner
            userRole
          };
        })
      );

      setNotebooks(notebooksWithData);
    } catch (error) {
      console.error('Error fetching notebooks:', error);
      toast.error('Failed to load notebooks');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchNotebooks();
  }, [fetchNotebooks]);

  const addNotebook = async (title: string) => {
    if (!user) return null;

    try {
      const maxOrder = notebooks.length > 0
        ? Math.max(...notebooks.map(nb => nb.order_index || 0))
        : -1;

      const { data, error } = await supabase
        .from('notebooks')
        .insert({ title, owner_id: user.id, order_index: maxOrder + 1 })
        .select()
        .single();

      if (error) throw error;
      
      await fetchNotebooks();
      return data;
    } catch (error) {
      console.error('Error adding notebook:', error);
      toast.error('Failed to create notebook');
      return null;
    }
  };

  const renameNotebook = async (id: string, title: string) => {
    try {
      const { error } = await supabase
        .from('notebooks')
        .update({ title })
        .eq('id', id);

      if (error) throw error;
      
      setNotebooks(prev => prev.map(nb => 
        nb.id === id ? { ...nb, title } : nb
      ));
    } catch (error) {
      console.error('Error renaming notebook:', error);
      toast.error('Failed to rename notebook');
    }
  };

  const deleteNotebook = async (id: string) => {
    try {
      const { error } = await supabase
        .from('notebooks')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setNotebooks(prev => prev.filter(nb => nb.id !== id));
    } catch (error) {
      console.error('Error deleting notebook:', error);
      toast.error('Failed to delete notebook');
    }
  };

  const addNote = async (notebookId: string, title: string) => {
    try {
      const { data, error } = await supabase
        .from('notes')
        .insert({ notebook_id: notebookId, title })
        .select()
        .single();

      if (error) throw error;
      
      setNotebooks(prev => prev.map(nb => 
        nb.id === notebookId 
          ? { ...nb, notes: [...nb.notes, { ...data, tasks: [] }] } 
          : nb
      ));
    } catch (error) {
      console.error('Error adding note:', error);
      toast.error('Failed to create note');
    }
  };

  const renameNote = async (notebookId: string, noteId: string, title: string) => {
    try {
      const { error } = await supabase
        .from('notes')
        .update({ title })
        .eq('id', noteId);

      if (error) throw error;
      
      setNotebooks(prev => prev.map(nb => 
        nb.id === notebookId 
          ? { ...nb, notes: nb.notes.map(n => n.id === noteId ? { ...n, title } : n) } 
          : nb
      ));
    } catch (error) {
      console.error('Error renaming note:', error);
      toast.error('Failed to rename note');
    }
  };

  const deleteNote = async (notebookId: string, noteId: string) => {
    try {
      const { error } = await supabase
        .from('notes')
        .delete()
        .eq('id', noteId);

      if (error) throw error;
      
      setNotebooks(prev => prev.map(nb => 
        nb.id === notebookId 
          ? { ...nb, notes: nb.notes.filter(n => n.id !== noteId) } 
          : nb
      ));
    } catch (error) {
      console.error('Error deleting note:', error);
      toast.error('Failed to delete note');
    }
  };

  const addTask = async (notebookId: string, noteId: string, title: string, folderId: string | null = null) => {
    try {
      const notebook = notebooks.find(nb => nb.id === notebookId);
      const note = notebook?.notes.find(n => n.id === noteId);
      const folderTasks = folderId 
        ? note?.tasks.filter(t => t.folder_id === folderId) || []
        : note?.tasks.filter(t => !t.folder_id) || [];
      const maxOrder = folderTasks.length > 0
        ? Math.max(...folderTasks.map(t => t.order_index || 0))
        : -1;

      const { data, error } = await supabase
        .from('tasks')
        .insert({ note_id: noteId, title, folder_id: folderId, order_index: maxOrder + 1 })
        .select()
        .single();

      if (error) throw error;
      
      setNotebooks(prev => prev.map(nb => 
        nb.id === notebookId 
          ? { 
              ...nb, 
              notes: nb.notes.map(n => 
                n.id === noteId 
                  ? { ...n, tasks: [...n.tasks, { ...data, completedBy: [], completions: [] }] } 
                  : n
              )
            } 
          : nb
      ));
    } catch (error) {
      console.error('Error adding task:', error);
      toast.error('Failed to create task');
    }
  };

  const renameTask = async (notebookId: string, noteId: string, taskId: string, title: string) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ title })
        .eq('id', taskId);

      if (error) throw error;
      
      setNotebooks(prev => prev.map(nb => 
        nb.id === notebookId 
          ? { 
              ...nb, 
              notes: nb.notes.map(n => 
                n.id === noteId 
                  ? { ...n, tasks: n.tasks.map(t => t.id === taskId ? { ...t, title } : t) } 
                  : n
              )
            } 
          : nb
      ));
    } catch (error) {
      console.error('Error renaming task:', error);
      toast.error('Failed to rename task');
    }
  };

  const deleteTask = async (notebookId: string, noteId: string, taskId: string) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;
      
      setNotebooks(prev => prev.map(nb => 
        nb.id === notebookId 
          ? { 
              ...nb, 
              notes: nb.notes.map(n => 
                n.id === noteId 
                  ? { ...n, tasks: n.tasks.filter(t => t.id !== taskId) } 
                  : n
              )
            } 
          : nb
      ));
    } catch (error) {
      console.error('Error deleting task:', error);
      toast.error('Failed to delete task');
    }
  };

  const toggleTask = async (notebookId: string, noteId: string, taskId: string) => {
    if (!user) return;

    try {
      const notebook = notebooks.find(nb => nb.id === notebookId);
      const note = notebook?.notes.find(n => n.id === noteId);
      const task = note?.tasks.find(t => t.id === taskId);
      
      if (!task) return;

      const isCompleted = task.completedBy.includes(user.id);

      if (isCompleted) {
        // Remove completion
        const { error } = await supabase
          .from('task_completions')
          .delete()
          .eq('task_id', taskId)
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        // Add completion
        const { error } = await supabase
          .from('task_completions')
          .insert({ task_id: taskId, user_id: user.id });

        if (error) throw error;
      }

      // Get user's profile data for the completion
      const { data: profile } = await supabase
        .from('profiles')
        .select('name, avatar_url')
        .eq('user_id', user.id)
        .maybeSingle();
      
      const userName = profile?.name || 'Unknown';
      const avatarUrl = profile?.avatar_url || null;

      // Update local state
      setNotebooks(prev => prev.map(nb => 
        nb.id === notebookId 
          ? { 
              ...nb, 
              notes: nb.notes.map(n => 
                n.id === noteId 
                  ? { 
                      ...n, 
                      tasks: n.tasks.map(t => 
                        t.id === taskId 
                          ? { 
                              ...t, 
                              completedBy: isCompleted 
                                ? t.completedBy.filter(id => id !== user.id)
                                : [...t.completedBy, user.id],
                              completions: isCompleted
                                ? t.completions.filter(c => c.userId !== user.id)
                                : [...t.completions, { userId: user.id, userName, avatarUrl }]
                            } 
                          : t
                      )
                    } 
                  : n
              )
            } 
          : nb
      ));
    } catch (error) {
      console.error('Error toggling task:', error);
      toast.error('Failed to update task');
    }
  };

  const reorderNotebooks = async (newOrder: { id: string; order_index: number }[]) => {
    try {
      const updates = newOrder.map(({ id, order_index }) =>
        supabase.from('notebooks').update({ order_index }).eq('id', id)
      );
      await Promise.all(updates);
      await fetchNotebooks();
    } catch (error) {
      console.error('Error reordering notebooks:', error);
      toast.error('Failed to reorder notebooks');
    }
  };

  // Optimistic mutation for reordering notes
  const reorderNotesMutation = useMutation({
    mutationFn: async ({ notebookId, newOrder }: { notebookId: string; newOrder: { id: string; order_index: number }[] }) => {
      const updates = newOrder.map(({ id, order_index }) =>
        supabase.from('notes').update({ order_index }).eq('id', id).eq('notebook_id', notebookId)
      );
      const results = await Promise.all(updates);
      const errors = results.filter(r => r.error);
      if (errors.length > 0) {
        throw errors[0].error;
      }
      return { notebookId, newOrder };
    },
    onMutate: async ({ notebookId, newOrder }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['notebooks'] });

      // Snapshot the previous value
      const previousNotebooks = [...notebooks];

      // Optimistically update the UI
      setNotebooks(prev => prev.map(nb => {
        if (nb.id === notebookId) {
          const noteMap = new Map(nb.notes.map(n => [n.id, n]));
          const reorderedNotes = newOrder.map(({ id }) => noteMap.get(id)).filter(Boolean) as Note[];
          return { ...nb, notes: reorderedNotes };
        }
        return nb;
      }));

      // Return context with the previous value
      return { previousNotebooks };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousNotebooks) {
        setNotebooks(context.previousNotebooks);
      }
      console.error('Error reordering notes:', err);
      toast.error('Failed to reorder notes');
    },
    onSettled: () => {
      // Refetch to ensure consistency
      fetchNotebooks();
    },
  });

  // Optimistic mutation for reordering tasks
  const reorderTasksMutation = useMutation({
    mutationFn: async ({ noteId, newOrder }: { noteId: string; newOrder: { id: string; order_index: number }[] }) => {
      const updates = newOrder.map(({ id, order_index }) =>
        supabase.from('tasks').update({ order_index }).eq('id', id).eq('note_id', noteId)
      );
      const results = await Promise.all(updates);
      const errors = results.filter(r => r.error);
      if (errors.length > 0) {
        throw errors[0].error;
      }
      return { noteId, newOrder };
    },
    onMutate: async ({ noteId, newOrder }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['notebooks'] });

      // Snapshot the previous value
      const previousNotebooks = [...notebooks];

      // Optimistically update the UI
      setNotebooks(prev => prev.map(nb => ({
        ...nb,
        notes: nb.notes.map(note => {
          if (note.id === noteId) {
            const taskMap = new Map(note.tasks.filter(t => !t.folder_id).map(t => [t.id, t]));
            const reorderedTasks = newOrder.map(({ id }) => taskMap.get(id)).filter(Boolean);
            const folderTasks = note.tasks.filter(t => t.folder_id);
            return { ...note, tasks: [...reorderedTasks, ...folderTasks] };
          }
          return note;
        })
      })));

      // Return context with the previous value
      return { previousNotebooks };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousNotebooks) {
        setNotebooks(context.previousNotebooks);
      }
      console.error('Error reordering tasks:', err);
      toast.error('Failed to reorder tasks');
    },
    onSettled: () => {
      // Refetch to ensure consistency
      fetchNotebooks();
    },
  });

  const reorderNotes = async (notebookId: string, newOrder: { id: string; order_index: number }[]) => {
    reorderNotesMutation.mutate({ notebookId, newOrder });
  };

  const reorderTasks = async (noteId: string, newOrder: { id: string; order_index: number }[]) => {
    reorderTasksMutation.mutate({ noteId, newOrder });
  };

  const addFolder = async (noteId: string, title: string) => {
    try {
      const notebook = notebooks.find(nb => nb.notes.some(n => n.id === noteId));
      if (!notebook) return null;

      const note = notebook.notes.find(n => n.id === noteId);
      const maxOrder = note?.folders.length > 0 
        ? Math.max(...note.folders.map(f => f.order_index))
        : -1;

      const { data, error } = await supabase
        .from('task_folders')
        .insert({ note_id: noteId, title, order_index: maxOrder + 1 })
        .select()
        .single();

      if (error) throw error;
      
      await fetchNotebooks();
      return data;
    } catch (error) {
      console.error('Error adding folder:', error);
      toast.error('Failed to create folder');
      return null;
    }
  };

  const renameFolder = async (folderId: string, title: string) => {
    try {
      const { error } = await supabase
        .from('task_folders')
        .update({ title })
        .eq('id', folderId);

      if (error) throw error;
      
      await fetchNotebooks();
    } catch (error) {
      console.error('Error renaming folder:', error);
      toast.error('Failed to rename folder');
    }
  };

  const deleteFolder = async (folderId: string) => {
    try {
      const { error } = await supabase
        .from('task_folders')
        .delete()
        .eq('id', folderId);

      if (error) throw error;
      
      await fetchNotebooks();
    } catch (error) {
      console.error('Error deleting folder:', error);
      toast.error('Failed to delete folder');
    }
  };

  const toggleFolderCollapse = async (folderId: string, isCollapsed: boolean) => {
    try {
      const { error } = await supabase
        .from('task_folders')
        .update({ is_collapsed: isCollapsed })
        .eq('id', folderId);

      if (error) throw error;
      
      setNotebooks(prev => prev.map(nb => ({
        ...nb,
        notes: nb.notes.map(n => ({
          ...n,
          folders: n.folders.map(f => f.id === folderId ? { ...f, is_collapsed: isCollapsed } : f)
        }))
      })));
    } catch (error) {
      console.error('Error toggling folder:', error);
    }
  };

  // Optimistic mutation for moving tasks between folders
  const moveTaskToFolderMutation = useMutation({
    mutationFn: async ({ taskId, folderId }: { taskId: string; folderId: string | null }) => {
      const { error } = await supabase
        .from('tasks')
        .update({ folder_id: folderId })
        .eq('id', taskId);

      if (error) throw error;
      return { taskId, folderId };
    },
    onMutate: async ({ taskId, folderId }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['notebooks'] });

      // Snapshot the previous value
      const previousNotebooks = [...notebooks];

      // Optimistically update the UI
      setNotebooks(prev => prev.map(nb => ({
        ...nb,
        notes: nb.notes.map(note => ({
          ...note,
          tasks: note.tasks.map(task => 
            task.id === taskId ? { ...task, folder_id: folderId } : task
          )
        }))
      })));

      // Return context with the previous value
      return { previousNotebooks };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousNotebooks) {
        setNotebooks(context.previousNotebooks);
      }
      console.error('Error moving task:', err);
      toast.error('Failed to move task');
    },
    onSettled: () => {
      // Refetch to ensure consistency
      fetchNotebooks();
    },
  });

  const moveTaskToFolder = async (taskId: string, folderId: string | null) => {
    moveTaskToFolderMutation.mutate({ taskId, folderId });
  };

  return {
    notebooks,
    loading,
    refetch: fetchNotebooks,
    addNotebook,
    renameNotebook,
    deleteNotebook,
    reorderNotebooks,
    addNote,
    renameNote,
    deleteNote,
    reorderNotes,
    addTask,
    renameTask,
    deleteTask,
    reorderTasks,
    toggleTask,
    addFolder,
    renameFolder,
    deleteFolder,
    toggleFolderCollapse,
    moveTaskToFolder,
  };
}
