-- Allow admin/manager users to remove unapproved profiles from the approvals queue.
DROP POLICY IF EXISTS "AdminsManagers can delete pending profiles" ON public.profiles;

CREATE POLICY "AdminsManagers can delete pending profiles" ON public.profiles
  FOR DELETE
  USING (
    is_approved = false
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'manager')
    )
  );
