-- The issue is that the SELECT policy check runs during INSERT operations
-- We need to make sure owners can always see their own notebooks

-- First, let's recreate the function to be more explicit
CREATE OR REPLACE FUNCTION public.is_notebook_member(notebook_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.notebooks
    WHERE id = notebook_uuid AND owner_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.notebook_members
    WHERE notebook_id = notebook_uuid AND user_id = auth.uid()
  );
$$;

-- Drop and recreate the SELECT policy for notebooks with a simpler condition
DROP POLICY IF EXISTS "Users can view notebooks they own or are members of" ON public.notebooks;

CREATE POLICY "Users can view notebooks they own or are members of" 
ON public.notebooks 
FOR SELECT 
TO authenticated
USING (
  owner_id = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM public.notebook_members 
    WHERE notebook_id = id AND user_id = auth.uid()
  )
);