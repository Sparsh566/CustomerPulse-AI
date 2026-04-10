-- Allow admin/manager users to approve pending accounts from the admin panel.
-- Existing self-update profile policy remains in place for normal users.
DROP POLICY IF EXISTS "AdminsManagers can approve profiles" ON public.profiles;

CREATE POLICY "AdminsManagers can approve profiles" ON public.profiles
  FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
  );
