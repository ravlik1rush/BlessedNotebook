import { useEffect, useState, useRef } from 'react';
import { MessageSquare, Send, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface CommentRow {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  created_at: string;
  user_name?: string | null;
  avatar_url?: string | null;
}

interface TaskCommentsPanelProps {
  taskId: string;
  taskTitle?: string;
  children: React.ReactNode;
  onCommentsOpened?: () => void;
}

export function TaskCommentsPanel({ taskId, taskTitle, children, onCommentsOpened }: TaskCommentsPanelProps) {
  const { user, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [newText, setNewText] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const optimisticIdRef = useRef<string | null>(null);

  // Call onCommentsOpened when panel opens
  useEffect(() => {
    if (open && onCommentsOpened) {
      onCommentsOpened();
    }
  }, [open, onCommentsOpened]);

  useEffect(() => {
    if (!taskId || !open) {
      setComments([]);
      return;
    }

    fetchComments();

    const channelName = `task_comments_${taskId}_${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'task_comments',
          filter: `task_id=eq.${taskId}`,
        },
        async (payload) => {
          console.log('Realtime event:', payload.eventType, payload);
          
          if (payload.eventType === 'INSERT') {
            const newRow = payload.new as any;
            
            // Check if comment already exists (avoid duplicates)
            setComments(prev => {
              const exists = prev.some(c => c.id === newRow.id);
              if (exists) {
                console.log('Comment already exists, skipping:', newRow.id);
                return prev;
              }
              
              // Fetch profile info for the user
              supabase
                .from('profiles')
                .select('name, avatar_url')
                .eq('user_id', newRow.user_id)
                .maybeSingle()
                .then(({ data, error }) => {
                  if (error) {
                    console.error('Error fetching profile:', error);
                  }
                  
                  setComments(current => {
                    // Double-check it doesn't exist (race condition protection)
                    const alreadyExists = current.some(c => c.id === newRow.id);
                    if (alreadyExists) {
                      console.log('Comment already exists in state, skipping');
                      return current;
                    }
                    
                    const newComment: CommentRow = {
                      ...newRow,
                      user_name: data?.name || 'Unknown',
                      avatar_url: data?.avatar_url || null,
                    };
                    
                    console.log('Adding new comment from realtime:', newComment);
                    const updated = [...current, newComment];
                    scrollToBottom();
                    return updated;
                  });
                });
              
              return prev;
            });
          }
          
          if (payload.eventType === 'DELETE') {
            setComments(prev => prev.filter(c => c.id !== payload.old.id));
          }
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to task_comments');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('Channel subscription error');
        }
      });

    return () => {
      console.log('Cleaning up subscription');
      supabase.removeChannel(channel);
      optimisticIdRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId, open]);

  const fetchComments = async () => {
    if (!taskId) return;
    setLoading(true);
    try {
      const { data: commentsData, error: commentsError } = await supabase
        .from('task_comments')
        .select('id, task_id, user_id, content, created_at')
        .eq('task_id', taskId)
        .order('created_at', { ascending: true });

      if (commentsError) throw commentsError;

      if (!commentsData || commentsData.length === 0) {
        setComments([]);
        setLoading(false);
        return;
      }

      // Get unique user IDs
      const userIds = [...new Set(commentsData.map(c => c.user_id))];
      
      // Fetch profiles for those users
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, name, avatar_url')
        .in('user_id', userIds);

      const profileMap = new Map(
        (profilesData || []).map(p => [p.user_id, { name: p.name, avatar_url: p.avatar_url }])
      );

      const rows: CommentRow[] = commentsData.map((c) => {
        const profile = profileMap.get(c.user_id);
        return {
          id: c.id,
          task_id: c.task_id,
          user_id: c.user_id,
          content: c.content,
          created_at: c.created_at,
          user_name: profile?.name || 'Unknown',
          avatar_url: profile?.avatar_url || null,
        };
      });

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
      if (listRef.current) {
        const viewport = listRef.current.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
        if (viewport) {
          viewport.scrollTop = viewport.scrollHeight;
        }
      }
    }, 150);
  };

  const handleSend = async () => {
    if (!newText.trim() || sending) return;
    if (!user) return toast.error('You must be signed in');

    const content = newText.trim();
    const tempId = `temp_${Date.now()}_${Math.random()}`;
    const now = new Date().toISOString();

    // Optimistic UI: Add comment immediately
    const optimisticComment: CommentRow = {
      id: tempId,
      task_id: taskId,
      user_id: user.id,
      content: content,
      created_at: now,
      user_name: profile?.name || 'You',
      avatar_url: profile?.avatar_url || null,
    };

    setComments(prev => [...prev, optimisticComment]);
    setNewText('');
    setSending(true);
    scrollToBottom();

    try {
      const { data, error } = await supabase
        .from('task_comments')
        .insert({ task_id: taskId, user_id: user.id, content: content })
        .select()
        .single();

      if (error) throw error;

      // Replace optimistic comment with real one immediately
      // This ensures instant feedback even if realtime subscription is delayed
      setComments(prev => {
        const withoutTemp = prev.filter(c => c.id !== tempId);
        // Check if realtime already added it
        const alreadyExists = withoutTemp.some(c => c.id === data.id);
        if (alreadyExists) {
          return withoutTemp;
        }
        // Add the real comment
        return [...withoutTemp, {
          id: data.id,
          task_id: data.task_id,
          user_id: data.user_id,
          content: data.content,
          created_at: data.created_at,
          user_name: profile?.name || 'You',
          avatar_url: profile?.avatar_url || null,
        }];
      });
      
      optimisticIdRef.current = data.id;
      scrollToBottom();
    } catch (error) {
      console.error('Send comment error', error);
      // Remove optimistic comment on error
      setComments(prev => prev.filter(c => c.id !== tempId));
      toast.error('Failed to send comment');
      setNewText(content); // Restore text so user can retry
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!user) return;
    
    const { error } = await supabase
      .from('task_comments')
      .delete()
      .eq('id', commentId)
      .eq('user_id', user.id);

    if (error) {
      console.error('Delete comment error', error);
      toast.error('Failed to delete comment');
    }
    // the realtime subscription will remove the comment
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {children}
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Comments
          </SheetTitle>
          <SheetDescription>
            {taskTitle ? `Discuss: ${taskTitle}` : 'Add comments and collaborate on this task'}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 flex flex-col h-[calc(100vh-120px)]">
          <ScrollArea ref={listRef} className="flex-1 pr-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-sm text-muted-foreground">Loading comments...</div>
              </div>
            ) : comments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <MessageSquare className="w-12 h-12 text-muted-foreground/30 mb-4" />
                <p className="text-sm text-muted-foreground">No comments yet</p>
                <p className="text-xs text-muted-foreground mt-1">Be the first to comment!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {comments.map(c => (
                  <div key={c.id} className="flex items-start gap-3 group">
                    <Avatar className="w-8 h-8 flex-shrink-0">
                      <AvatarImage src={c.avatar_url || undefined} alt={c.user_name || 'U'} />
                      <AvatarFallback className="text-xs">
                        {(c.user_name || 'U').charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">{c.user_name}</span>
                        {c.user_id === user?.id && (
                          <span className="text-xs text-muted-foreground">(you)</span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                        </span>
                        {c.user_id === user?.id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="ml-auto h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleDeleteComment(c.id)}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                      <div className="text-sm text-foreground whitespace-pre-wrap break-words">
                        {c.content}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          <div className="pt-4 border-t border-border mt-4">
            <div className="flex gap-2">
              <Input
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Write a comment..."
                className="flex-1"
              />
              <Button 
                onClick={handleSend} 
                disabled={!newText.trim()}
                size="icon"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
