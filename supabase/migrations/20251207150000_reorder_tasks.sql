-- Migration: Add server-side RPC to reorder tasks atomically
-- Creates function `reorder_tasks(p_task_ids uuid[])`

CREATE OR REPLACE FUNCTION public.reorder_tasks(p_task_ids uuid[])
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  i integer;
  v_task_id uuid;
BEGIN
  IF p_task_ids IS NULL THEN
    RETURN;
  END IF;

  FOR i IN array_lower(p_task_ids, 1)..array_upper(p_task_ids, 1) LOOP
    v_task_id := p_task_ids[i];
    UPDATE public.tasks
    SET order_index = i
    WHERE id = v_task_id;
  END LOOP;
END;
$$;

-- Grant execute to authenticated role so clients can call RPC
GRANT EXECUTE ON FUNCTION public.reorder_tasks(uuid[]) TO authenticated;
