import { useState } from 'react';
import { useNotebooks } from '@/hooks/useNotebooks';
import { useAuth } from '@/context/AuthContext';
import { NotebookSidebar } from '@/components/NotebookSidebar';
import { NotebookView } from '@/components/NotebookView';
import { Loader2 } from 'lucide-react';

const Index = () => {
  const { notebooks, loading, refetch, ...actions } = useNotebooks();
  const { user, profile } = useAuth();
  const [selectedNotebookId, setSelectedNotebookId] = useState<string | null>(null);

  // Auto-select first notebook when loaded
  if (!selectedNotebookId && notebooks.length > 0 && !loading) {
    setSelectedNotebookId(notebooks[0].id);
  }

  const selectedNotebook = notebooks.find(nb => nb.id === selectedNotebookId);

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <NotebookSidebar
        notebooks={notebooks}
        selectedNotebookId={selectedNotebookId}
        onSelectNotebook={setSelectedNotebookId}
        onAddNotebook={async (title) => {
          const result = await actions.addNotebook(title);
          if (result) setSelectedNotebookId(result.id);
        }}
        onRenameNotebook={actions.renameNotebook}
        onDeleteNotebook={async (id) => {
          await actions.deleteNotebook(id);
          if (selectedNotebookId === id) {
            setSelectedNotebookId(notebooks.find(nb => nb.id !== id)?.id || null);
          }
        }}
        currentUserId={user?.id || ''}
        currentUserName={profile?.name || ''}
        currentUserEmail={profile?.email || ''}
        currentUserAvatar={profile?.avatar_url || null}
        onRefetch={refetch}
      />
      <NotebookView
        notebook={selectedNotebook || null}
        currentUserId={user?.id || ''}
        onAddNote={(notebookId, title) => actions.addNote(notebookId, title)}
        onRenameNote={actions.renameNote}
        onDeleteNote={actions.deleteNote}
        onAddTask={(notebookId, noteId, title, folderId) => actions.addTask(notebookId, noteId, title, folderId)}
        onRenameTask={actions.renameTask}
        onDeleteTask={actions.deleteTask}
        onToggleTask={actions.toggleTask}
        onAddFolder={(noteId, title) => {
          const notebook = notebooks.find(nb => nb.notes.some(n => n.id === noteId));
          if (notebook) actions.addFolder(noteId, title);
        }}
        onRenameFolder={actions.renameFolder}
        onDeleteFolder={actions.deleteFolder}
        onToggleFolderCollapse={actions.toggleFolderCollapse}
        onReorderNotes={actions.reorderNotes}
        onReorderTasks={actions.reorderTasks}
        onMoveTaskToFolder={actions.moveTaskToFolder}
        onRefetch={refetch}
      />
    </div>
  );
};

export default Index;
