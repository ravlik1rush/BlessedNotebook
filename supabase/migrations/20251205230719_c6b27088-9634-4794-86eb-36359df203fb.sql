-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create notebooks table
CREATE TABLE public.notebooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  is_shared BOOLEAN NOT NULL DEFAULT false,
  share_code TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user roles enum
CREATE TYPE public.notebook_role AS ENUM ('owner', 'admin', 'reader');

-- Create notebook members table
CREATE TABLE public.notebook_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notebook_id UUID NOT NULL REFERENCES public.notebooks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  role notebook_role NOT NULL DEFAULT 'reader',
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(notebook_id, user_id)
);

-- Create notes table
CREATE TABLE public.notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notebook_id UUID NOT NULL REFERENCES public.notebooks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create tasks table
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create task completions table (tracks who completed each task)
CREATE TABLE public.task_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(task_id, user_id)
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notebooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notebook_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_completions ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Helper function to check notebook membership
CREATE OR REPLACE FUNCTION public.is_notebook_member(notebook_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.notebook_members
    WHERE notebook_id = notebook_uuid AND user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.notebooks
    WHERE id = notebook_uuid AND owner_id = auth.uid()
  );
$$;

-- Helper function to check notebook role
CREATE OR REPLACE FUNCTION public.get_notebook_role(notebook_uuid UUID)
RETURNS notebook_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role FROM public.notebook_members WHERE notebook_id = notebook_uuid AND user_id = auth.uid()),
    (SELECT 'owner'::notebook_role FROM public.notebooks WHERE id = notebook_uuid AND owner_id = auth.uid())
  );
$$;

-- Notebooks policies
CREATE POLICY "Users can view notebooks they own or are members of" ON public.notebooks
  FOR SELECT USING (public.is_notebook_member(id));
CREATE POLICY "Users can create notebooks" ON public.notebooks
  FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners can update notebooks" ON public.notebooks
  FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Owners can delete notebooks" ON public.notebooks
  FOR DELETE USING (auth.uid() = owner_id);

-- Notebook members policies
CREATE POLICY "Members can view notebook members" ON public.notebook_members
  FOR SELECT USING (public.is_notebook_member(notebook_id));
CREATE POLICY "Owners can manage members" ON public.notebook_members
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.notebooks WHERE id = notebook_id AND owner_id = auth.uid())
  );
CREATE POLICY "Owners can update members" ON public.notebook_members
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.notebooks WHERE id = notebook_id AND owner_id = auth.uid())
  );
CREATE POLICY "Owners can delete members" ON public.notebook_members
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.notebooks WHERE id = notebook_id AND owner_id = auth.uid())
  );
CREATE POLICY "Users can add themselves via share code" ON public.notebook_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Notes policies
CREATE POLICY "Members can view notes" ON public.notes
  FOR SELECT USING (public.is_notebook_member(notebook_id));
CREATE POLICY "Owners and admins can create notes" ON public.notes
  FOR INSERT WITH CHECK (public.get_notebook_role(notebook_id) IN ('owner', 'admin'));
CREATE POLICY "Owners and admins can update notes" ON public.notes
  FOR UPDATE USING (public.get_notebook_role(notebook_id) IN ('owner', 'admin'));
CREATE POLICY "Owners and admins can delete notes" ON public.notes
  FOR DELETE USING (public.get_notebook_role(notebook_id) IN ('owner', 'admin'));

-- Tasks policies
CREATE POLICY "Members can view tasks" ON public.tasks
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.notes WHERE id = note_id AND public.is_notebook_member(notebook_id))
  );
CREATE POLICY "Owners and admins can create tasks" ON public.tasks
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.notes WHERE id = note_id AND public.get_notebook_role(notebook_id) IN ('owner', 'admin'))
  );
CREATE POLICY "Owners and admins can update tasks" ON public.tasks
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.notes WHERE id = note_id AND public.get_notebook_role(notebook_id) IN ('owner', 'admin'))
  );
CREATE POLICY "Owners and admins can delete tasks" ON public.tasks
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.notes WHERE id = note_id AND public.get_notebook_role(notebook_id) IN ('owner', 'admin'))
  );

-- Task completions policies
CREATE POLICY "Members can view completions" ON public.task_completions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN public.notes n ON t.note_id = n.id
      WHERE t.id = task_id AND public.is_notebook_member(n.notebook_id)
    )
  );
CREATE POLICY "Members can complete tasks" ON public.task_completions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove own completions" ON public.task_completions
  FOR DELETE USING (auth.uid() = user_id);

-- Function to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1)),
    NEW.email
  );
  RETURN NEW;
END;
$$;

-- Trigger for auto-creating profile
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to generate share code
CREATE OR REPLACE FUNCTION public.generate_share_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INT;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$;