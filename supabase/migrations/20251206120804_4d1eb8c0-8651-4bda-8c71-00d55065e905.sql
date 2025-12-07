-- Add a policy that allows authenticated users to view notebooks when querying by share_code
-- This is necessary for the "Join Notebook" feature to work

CREATE POLICY "Users can view shared notebooks by share code" 
ON public.notebooks 
FOR SELECT 
TO authenticated
USING (
  is_shared = true AND share_code IS NOT NULL
);