import { useState, useEffect } from 'react';
import { Users, Crown, Shield, Eye, Copy, Check, Share2, X, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ProgressBar } from './ProgressBar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Member {
  user_id: string;
  role: 'owner' | 'admin' | 'reader';
  profile: {
    name: string;
    email: string;
    avatar_url: string | null;
  } | null;
  progress: {
    completed: number;
    total: number;
    percentage: number;
  };
}

interface MembersPanelProps {
  notebookId: string;
  isOwner: boolean;
  shareCode: string | null;
  onShareCodeGenerated?: () => void;
  onMakePrivate?: () => void;
  children: React.ReactNode;
}

export function MembersPanel({ notebookId, isOwner, shareCode, onShareCodeGenerated, onMakePrivate, children }: MembersPanelProps) {
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [generatingCode, setGeneratingCode] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (open) {
      fetchMembers();
    }
  }, [open, notebookId]);

  const fetchMembers = async () => {
    setLoading(true);
    try {
      // Get notebook members
      const { data: memberData, error: memberError } = await supabase
        .from('notebook_members')
        .select(`
          user_id,
          role,
          profiles!notebook_members_user_id_fkey (
            name,
            email,
            avatar_url
          )
        `)
        .eq('notebook_id', notebookId);

      if (memberError) {
        console.error('Error fetching members:', memberError);
        return;
      }

      // Get owner
      const { data: notebook } = await supabase
        .from('notebooks')
        .select(`
          owner_id,
          profiles!notebooks_owner_id_fkey (
            name,
            email,
            avatar_url
          )
        `)
        .eq('id', notebookId)
        .single();

      // Get all tasks for progress calculation
      const { data: notes } = await supabase
        .from('notes')
        .select('id')
        .eq('notebook_id', notebookId);

      const noteIds = notes?.map(n => n.id) || [];
      
      let tasks: { id: string }[] = [];
      if (noteIds.length > 0) {
        const { data: taskData } = await supabase
          .from('tasks')
          .select('id')
          .in('note_id', noteIds);
        tasks = taskData || [];
      }

      const taskIds = tasks.map(t => t.id);

      // Get completions for all users
      let completions: { user_id: string; task_id: string }[] = [];
      if (taskIds.length > 0) {
        const { data: completionData } = await supabase
          .from('task_completions')
          .select('user_id, task_id')
          .in('task_id', taskIds);
        completions = completionData || [];
      }

      // Build member list with progress
      const allMembers: Member[] = [];

      // Add owner first
      if (notebook?.owner_id) {
        const ownerCompletions = completions.filter(c => c.user_id === notebook.owner_id).length;
        allMembers.push({
          user_id: notebook.owner_id,
          role: 'owner',
          profile: notebook.profiles as { name: string; email: string; avatar_url: string | null } | null,
          progress: {
            completed: ownerCompletions,
            total: taskIds.length,
            percentage: taskIds.length > 0 ? Math.round((ownerCompletions / taskIds.length) * 100) : 0
          }
        });
      }

      // Add other members
      memberData?.forEach(m => {
        if (m.user_id !== notebook?.owner_id) {
          const memberCompletions = completions.filter(c => c.user_id === m.user_id).length;
          allMembers.push({
            user_id: m.user_id,
            role: m.role as 'owner' | 'admin' | 'reader',
            profile: m.profiles as { name: string; email: string; avatar_url: string | null } | null,
            progress: {
              completed: memberCompletions,
              total: taskIds.length,
              percentage: taskIds.length > 0 ? Math.round((memberCompletions / taskIds.length) * 100) : 0
            }
          });
        }
      });

      setMembers(allMembers);
    } catch (error) {
      console.error('Error fetching members:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateShareCode = async () => {
    setGeneratingCode(true);
    try {
      // Generate code using the database function
      const { data: codeData, error: codeError } = await supabase
        .rpc('generate_share_code');

      if (codeError) throw codeError;

      // Update notebook with the new share code and mark as shared
      const { error: updateError } = await supabase
        .from('notebooks')
        .update({ 
          share_code: codeData,
          is_shared: true 
        })
        .eq('id', notebookId);

      if (updateError) throw updateError;

      toast.success('Share code generated!');
      onShareCodeGenerated?.();
    } catch (error) {
      console.error('Error generating share code:', error);
      toast.error('Failed to generate share code');
    } finally {
      setGeneratingCode(false);
    }
  };

  const copyShareCode = async () => {
    if (!shareCode) return;
    await navigator.clipboard.writeText(shareCode);
    setCopied(true);
    toast.success('Share code copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const updateMemberRole = async (userId: string, newRole: 'admin' | 'reader') => {
    try {
      const { error } = await supabase
        .from('notebook_members')
        .update({ role: newRole })
        .eq('notebook_id', notebookId)
        .eq('user_id', userId);

      if (error) throw error;
      
      toast.success('Role updated');
      fetchMembers();
    } catch (error) {
      console.error('Error updating role:', error);
      toast.error('Failed to update role');
    }
  };

  const removeMember = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('notebook_members')
        .delete()
        .eq('notebook_id', notebookId)
        .eq('user_id', userId);

      if (error) throw error;
      
      toast.success('Member removed');
      fetchMembers();
    } catch (error) {
      console.error('Error removing member:', error);
      toast.error('Failed to remove member');
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner': return <Crown className="w-4 h-4" />;
      case 'admin': return <Shield className="w-4 h-4" />;
      default: return <Eye className="w-4 h-4" />;
    }
  };

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case 'owner': return 'bg-role-owner/10 text-role-owner border-role-owner/20';
      case 'admin': return 'bg-role-admin/10 text-role-admin border-role-admin/20';
      default: return 'bg-role-reader/10 text-role-reader border-role-reader/20';
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {children}
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px]">
          <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Members & EchoTasks
          </SheetTitle>
          <SheetDescription>
            View member EchoTasks and manage access.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Share Code Section */}
          {isOwner && (
            <div className="p-4 bg-muted/50 rounded-lg border border-border">
              <div className="flex items-center gap-2 mb-2">
                <Share2 className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">Share Code</span>
              </div>
              
              {shareCode ? (
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-background rounded-lg px-4 py-2 font-mono text-lg tracking-wider text-center border">
                    {shareCode}
                  </div>
                  <Button size="icon" variant="outline" onClick={copyShareCode}>
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              ) : (
                <Button 
                  onClick={generateShareCode} 
                  variant="outline" 
                  className="w-full"
                  disabled={generatingCode}
                >
                  {generatingCode ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    'Generate Share Code'
                  )}
                </Button>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                Share this code with others to let them join your notebook.
              </p>
              {shareCode && (
                <Button
                  variant="outline"
                  className="w-full mt-3"
                  onClick={async () => {
                    try {
                      // Remove all members except owner
                      const { error: deleteError } = await supabase
                        .from('notebook_members')
                        .delete()
                        .eq('notebook_id', notebookId);

                      if (deleteError) throw deleteError;

                      // Make notebook private
                      const { error: updateError } = await supabase
                        .from('notebooks')
                        .update({ 
                          is_shared: false,
                          share_code: null
                        })
                        .eq('id', notebookId);

                      if (updateError) throw updateError;

                      toast.success('Notebook is now private');
                      onMakePrivate?.();
                      setOpen(false);
                    } catch (error) {
                      console.error('Error making notebook private:', error);
                      toast.error('Failed to make notebook private');
                    }
                  }}
                >
                  Make Private
                </Button>
              )}
            </div>
          )}

          {/* Members List */}
          <div className="space-y-3">
            <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">
              Members ({members.length})
            </h3>
            
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-2">
                {members.map((member) => (
                  <div
                    key={member.user_id}
                    className="p-3 bg-card rounded-lg border border-border"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                        <span className="text-sm font-semibold text-primary">
                          {member.profile?.name?.charAt(0) || '?'}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">
                            {member.profile?.name || 'Unknown'}
                          </span>
                          {member.user_id === user?.id && (
                            <span className="text-xs text-muted-foreground">(you)</span>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground truncate block">
                          {member.profile?.email}
                        </span>
                      </div>
                      
                      {isOwner && member.role !== 'owner' ? (
                        <div className="flex items-center gap-2">
                          <Select
                            value={member.role}
                            onValueChange={(value) => updateMemberRole(member.user_id, value as 'admin' | 'reader')}
                          >
                            <SelectTrigger className="w-24 h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="reader">Reader</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => removeMember(member.user_id)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ) : (
                        <Badge 
                          variant="outline" 
                          className={cn('capitalize flex items-center gap-1', getRoleBadgeClass(member.role))}
                        >
                          {getRoleIcon(member.role)}
                          {member.role}
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <ProgressBar 
                        percentage={member.progress.percentage} 
                        size="sm" 
                        className="flex-1" 
                      />
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {member.progress.completed}/{member.progress.total}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
