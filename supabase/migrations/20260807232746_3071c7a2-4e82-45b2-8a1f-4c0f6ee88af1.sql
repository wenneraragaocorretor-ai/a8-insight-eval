-- Final fix for profiles RLS security finding: profiles_no_delete_policy_missing_billing_protection
-- 1. Create a restrictive DELETE policy for profiles (only allowing admins or explicit service_role)
-- Note: Profiles are usually deleted via CASCADE when the auth user is deleted, 
-- but this policy secures direct Data API delete attempts.

DROP POLICY IF EXISTS "Users can delete their own profile" ON public.profiles;
CREATE POLICY "Users can delete their own profile" 
ON public.profiles
FOR DELETE
TO authenticated
USING (
  -- Only allow if they are an admin. Normal users cannot delete their own profile row via Data API.
  public.has_role(auth.uid(), 'admin')
);

-- 2. Ensure all SECURITY DEFINER functions explicitly revoke execute from ALL roles except service_role
-- The linter warns about 'authenticated' being able to execute them.
-- While many need 'authenticated' for the app to work, we can reduce the surface.

-- handle_new_user_profile is truly internal.
REVOKE EXECUTE ON FUNCTION public.handle_new_user_profile() FROM authenticated, anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_new_user_profile() TO service_role;
