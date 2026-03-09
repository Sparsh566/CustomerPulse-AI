
-- Add is_approved column to profiles
ALTER TABLE public.profiles ADD COLUMN is_approved boolean NOT NULL DEFAULT false;

-- Update the handle_new_user function to use selected role from metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  selected_role text;
BEGIN
  selected_role := COALESCE(NEW.raw_user_meta_data->>'role', 'agent');
  
  -- Only allow agent or manager from signup
  IF selected_role NOT IN ('agent', 'manager') THEN
    selected_role := 'agent';
  END IF;

  INSERT INTO public.profiles (user_id, full_name, is_approved)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    CASE WHEN selected_role = 'agent' THEN true ELSE false END
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, selected_role::app_role);
  
  RETURN NEW;
END;
$function$;
