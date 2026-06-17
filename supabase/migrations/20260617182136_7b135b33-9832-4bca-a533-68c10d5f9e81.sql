INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::public.app_role
FROM auth.users u
WHERE lower(u.email) = lower('wenneraragaocorretor@gmail.com')
ON CONFLICT (user_id, role) DO NOTHING;