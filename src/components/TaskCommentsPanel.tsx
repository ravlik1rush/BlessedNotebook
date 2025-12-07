import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

interface CommentRow {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  created_at: string;
  user_name?: string | null;
  avatar_url?: string | null;
}

export function TaskCommentsPanel({ taskId, onClose }: { taskId: string; onClose?: () => void }) {
  const { user } = useAuth();
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [newText, setNewText] = useState('');
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!taskId) return;
    fetchComments();

    const channel = supabase
      .channel('public:task_comments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_comments', filter: `task_id=eq.${taskId}` }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const newRow = payload.new as any;
          // fetch profile info for the user
          supabase.from('profiles').select('name, avatar_url').eq('user_id', newRow.user_id).maybeSingle().then(({ data }) => {
            setComments(prev => [...prev, { ...newRow, user_name: data?.name || 'Unknown', avatar_url: data?.avatar_url || null }]);
            scrollToBottom();
          });
        }
        if (payload.eventType === 'DELETE') {
          setComments(prev => prev.filter(c => c.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  const fetchComments = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('task_comments')
        .select('id, task_id, user_id, content, created_at, profiles!inner(name, avatar_url)')
        .eq('task_id', taskId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const rows: CommentRow[] = (data || []).map((r: any) => ({
        id: r.id,
        task_id: r.task_id,
        user_id: r.user_id,
        content: r.content,
        created_at: r.created_at,
        user_name: r.profiles?.name || 'Unknown',
        avatar_url: r.profiles?.avatar_url || null,
      }));

      setComments(rows);
      scrollToBottom();
    } catch (error) {
      console.error('Failed to fetch comments', error);
      toast.error('Failed to load comments');
    } finally {
      setLoading(false);
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    }, 100);
  };

  const handleSend = async () => {
    if (!newText.trim()) return;
    if (!user) return toast.error('You must be signed in');

    const payload = { task_id: taskId, user_id: user.id, content: newText.trim() };
    const { error } = await supabase.from('task_comments').insert(payload);
    if (error) {
      console.error('Send comment error', error);
      toast.error('Failed to send comment');
      return;
    }
    setNewText('');
    // the realtime subscription will append the comment
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold">Comments</h3>
          <span className="text-sm text-muted-foreground">Task</span>
        </div>
        <div>
          <Button variant="ghost" size="sm" onClick={onClose}>Back to Members</Button>
        </div>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading && <div className="text-sm text-muted-foreground">Loading...</div>}
        {comments.map(c => (
          <div key={c.id} className="flex items-start gap-3">
            <Avatar className="w-9 h-9">
              <AvatarImage src={c.avatar_url || undefined} alt={c.user_name || 'U'} />
              <AvatarFallback>{(c.user_name || 'U').charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{c.user_name}</span>
                <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</span>
              </div>
              <div className="text-sm text-foreground mt-1">{c.content}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="p-3 border-t border-border">
        <div className="flex gap-2">
          <Input value={newText} onChange={(e) => setNewText(e.target.value)} placeholder="Write a comment..." />
          <Button onClick={handleSend}>Send</Button>
        </div>
      </div>
    </div>
  );
}

export default TaskCommentsPanel;
