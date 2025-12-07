-- Drop existing restrictive INSERT policy
DROP POLICY IF EXISTS "Users can create notebooks" ON public.notebooks;

-- Recreate as PERMISSIVE
CREATE POLICY "Users can create notebooks" 
ON public.notebooks 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = owner_id);

-- Also fix notes INSERT policy
DROP POLICY IF EXISTS "Owners and admins can create notes" ON public.notes;

CREATE POLICY "Owners and admins can create notes" 
ON public.notes 
FOR INSERT 
TO authenticated
WITH CHECK (get_notebook_role(notebook_id) = ANY (ARRAY['owner'::notebook_role, 'admin'::notebook_role]));

-- Fix tasks INSERT policy
DROP POLICY IF EXISTS "Owners and admins can create tasks" ON public.tasks;

CREATE POLICY "Owners and admins can create tasks" 
ON public.tasks 
FOR INSERT 
TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM notes
  WHERE notes.id = tasks.note_id AND get_notebook_role(notes.notebook_id) = ANY (ARRAY['owner'::notebook_role, 'admin'::notebook_role])
));

-- Fix task_completions INSERT policy
DROP POLICY IF EXISTS "Members can complete tasks" ON public.task_completions;

CREATE POLICY "Members can complete tasks" 
ON public.task_completions 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Fix notebook_members INSERT policies
DROP POLICY IF EXISTS "Owners can manage members" ON public.notebook_members;
DROP POLICY IF EXISTS "Users can add themselves via share code" ON public.notebook_members;

CREATE POLICY "Owners can manage members" 
ON public.notebook_members 
FOR INSERT 
TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM notebooks
  WHERE notebooks.id = notebook_members.notebook_id AND notebooks.owner_id = auth.uid()
));

CREATE POLICY "Users can add themselves via share code" 
ON public.notebook_members 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);