-- Migration: Add server-side RPC to reorder notes atomically
-- Creates function `reorder_notes(p_notebook_id uuid, p_note_ids uuid[])`

CREATE OR REPLACE FUNCTION public.reorder_notes(p_notebook_id uuid, p_note_ids uuid[])
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  i integer;
  v_note_id uuid;
BEGIN
  -- Security: ensure caller has sufficient role for this notebook
  IF public.get_notebook_role(p_notebook_id) NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'not_authorized_to_reorder_notes';
  END IF;

  IF p_note_ids IS NULL THEN
    RETURN;
  END IF;

  FOR i IN array_lower(p_note_ids, 1)..array_upper(p_note_ids, 1) LOOP
    v_note_id := p_note_ids[i];
    UPDATE public.notes
    SET order_index = i
    WHERE id = v_note_id AND notebook_id = p_notebook_id;
  END LOOP;
END;
$$;

-- Grant execute to authenticated role so clients can call RPC (RLS and function check further restricts access)
GRANT EXECUTE ON FUNCTION public.reorder_notes(uuid, uuid[]) TO authenticated;
