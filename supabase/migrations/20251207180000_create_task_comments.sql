-- Migration: Create task_comments table with RLS and policies
-- Adds `task_comments` for storing comments on tasks

CREATE TABLE IF NOT EXISTS public.task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

-- SELECT policy: visible to members of parent notebook
CREATE POLICY "Members can select comments" ON public.task_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN public.notes n ON n.id = t.note_id
      WHERE t.id = public.task_comments.task_id
        AND public.is_notebook_member(n.notebook_id)
    )
  );

-- INSERT policy: allowed for members of parent notebook
CREATE POLICY "Members can insert comments" ON public.task_comments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN public.notes n ON n.id = t.note_id
      WHERE t.id = public.task_comments.task_id
        AND public.is_notebook_member(n.notebook_id)
    )
  );

-- DELETE policy: users can delete their own comments
CREATE POLICY "Users can delete own comments" ON public.task_comments
  FOR DELETE USING (
    auth.uid()::uuid = public.task_comments.user_id
  );

-- (Optional) grant select/insert/delete to authenticated role if you need DB-level grants
GRANT SELECT, INSERT, DELETE ON public.task_comments TO authenticated;
