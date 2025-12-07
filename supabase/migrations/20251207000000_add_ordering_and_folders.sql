-- Add ordering fields
ALTER TABLE public.notebooks ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0;
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0;

-- Create task folders table
CREATE TABLE IF NOT EXISTS public.task_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  order_index INTEGER DEFAULT 0,
  is_collapsed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add folder_id to tasks
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES public.task_folders(id) ON DELETE SET NULL;

-- Enable RLS on task_folders
ALTER TABLE public.task_folders ENABLE ROW LEVEL SECURITY;

-- Task folders policies
CREATE POLICY "Members can view folders" ON public.task_folders
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.notes WHERE id = note_id AND public.is_notebook_member(notebook_id))
  );

CREATE POLICY "Owners and admins can create folders" ON public.task_folders
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.notes 
      WHERE id = note_id AND public.get_notebook_role(notebook_id) IN ('owner', 'admin')
    )
  );

CREATE POLICY "Owners and admins can update folders" ON public.task_folders
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.notes 
      WHERE id = note_id AND public.get_notebook_role(notebook_id) IN ('owner', 'admin')
    )
  );

CREATE POLICY "Owners and admins can delete folders" ON public.task_folders
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.notes 
      WHERE id = note_id AND public.get_notebook_role(notebook_id) IN ('owner', 'admin')
    )
  );

-- Update existing records to have order_index based on created_at
UPDATE public.notebooks SET order_index = EXTRACT(EPOCH FROM created_at)::INTEGER WHERE order_index = 0;
UPDATE public.notes SET order_index = EXTRACT(EPOCH FROM created_at)::INTEGER WHERE order_index = 0;
UPDATE public.tasks SET order_index = EXTRACT(EPOCH FROM created_at)::INTEGER WHERE order_index = 0;

