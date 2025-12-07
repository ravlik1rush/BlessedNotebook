-- Drop existing policies on notebooks
DROP POLICY IF EXISTS "Users can view notebooks they own or are members of" ON public.notebooks;

-- Recreate as PERMISSIVE (which is the default, but let's be explicit)
CREATE POLICY "Users can view notebooks they own or are members of" 
ON public.notebooks 
FOR SELECT 
TO authenticated
USING (is_notebook_member(id));

-- Also fix notebook_members SELECT policy
DROP POLICY IF EXISTS "Members can view notebook members" ON public.notebook_members;

CREATE POLICY "Members can view notebook members" 
ON public.notebook_members 
FOR SELECT 
TO authenticated
USING (is_notebook_member(notebook_id));

-- Fix notes SELECT policy
DROP POLICY IF EXISTS "Members can view notes" ON public.notes;

CREATE POLICY "Members can view notes" 
ON public.notes 
FOR SELECT 
TO authenticated
USING (is_notebook_member(notebook_id));

-- Fix tasks SELECT policy
DROP POLICY IF EXISTS "Members can view tasks" ON public.tasks;

CREATE POLICY "Members can view tasks" 
ON public.tasks 
FOR SELECT 
TO authenticated
USING (EXISTS (
  SELECT 1 FROM notes
  WHERE notes.id = tasks.note_id AND is_notebook_member(notes.notebook_id)
));

-- Fix task_completions SELECT policy
DROP POLICY IF EXISTS "Members can view completions" ON public.task_completions;

CREATE POLICY "Members can view completions" 
ON public.task_completions 
FOR SELECT 
TO authenticated
USING (EXISTS (
  SELECT 1 FROM tasks t
  JOIN notes n ON t.note_id = n.id
  WHERE t.id = task_completions.task_id AND is_notebook_member(n.notebook_id)
));