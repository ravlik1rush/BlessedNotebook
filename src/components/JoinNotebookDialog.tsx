import { useState } from 'react';
import { Link2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface JoinNotebookDialogProps {
  children: React.ReactNode;
  onJoined?: () => void;
}

export function JoinNotebookDialog({ children, onJoined }: JoinNotebookDialogProps) {
  const [open, setOpen] = useState(false);
  const [shareCode, setShareCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();

  const handleJoin = async () => {
    if (!shareCode.trim() || !user) return;

    setIsLoading(true);

    try {
      // Find notebook by share code
      const { data: notebook, error: notebookError } = await supabase
        .from('notebooks')
        .select('id, title, is_shared')
        .eq('share_code', shareCode.trim().toUpperCase())
        .maybeSingle();

      if (notebookError) {
        toast.error('Error finding notebook');
        return;
      }

      if (!notebook) {
        toast.error('Invalid share code');
        return;
      }

      if (!notebook.is_shared) {
        toast.error('This notebook is not shared');
        return;
      }

      // Check if already a member
      const { data: existingMember } = await supabase
        .from('notebook_members')
        .select('id')
        .eq('notebook_id', notebook.id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingMember) {
        toast.error('You are already a member of this notebook');
        return;
      }

      // Join as reader
      const { error: joinError } = await supabase
        .from('notebook_members')
        .insert({
          notebook_id: notebook.id,
          user_id: user.id,
          role: 'reader'
        });

      if (joinError) {
        console.error('Join error:', joinError);
        toast.error('Failed to join notebook');
        return;
      }

      toast.success(`Joined "${notebook.title}"!`);
      setShareCode('');
      setOpen(false);
      onJoined?.();
    } catch (error) {
      console.error('Error joining notebook:', error);
      toast.error('Failed to join notebook');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5" />
            Join a Shared Notebook
          </DialogTitle>
          <DialogDescription>
            Enter the share code to join someone else's notebook.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="share-code">Share Code</Label>
            <Input
              id="share-code"
              placeholder="e.g., ABC12345"
              value={shareCode}
              onChange={(e) => setShareCode(e.target.value.toUpperCase())}
              maxLength={8}
              className="text-center text-lg font-mono tracking-wider"
            />
          </div>

          <Button 
            onClick={handleJoin} 
            className="w-full" 
            disabled={isLoading || !shareCode.trim()}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Joining...
              </>
            ) : (
              'Join Notebook'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
