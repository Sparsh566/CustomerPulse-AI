-- Backend-safe approval endpoint for admin panel.
-- Uses SECURITY DEFINER so approval can proceed even with strict profile RLS,
-- while still enforcing role authorization at function level.
CREATE OR REPLACE FUNCTION public.approve_user_account(_target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions to approve users';
  END IF;

  UPDATE public.profiles
  SET is_approved = true,
      updated_at = now()
  WHERE user_id = _target_user_id
    AND is_approved = false;

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_user_account(uuid) TO authenticated;
