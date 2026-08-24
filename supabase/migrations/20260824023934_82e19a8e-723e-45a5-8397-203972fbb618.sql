-- 1. Roles enum
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'collaborator');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. User roles
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 4. Helper functions (security definer, avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.user_id = _user_id AND ur.role = _role AND p.is_active
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'admin');
$$;

CREATE OR REPLACE FUNCTION public.can_view_shared(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.user_id = _user_id AND p.is_active
  );
$$;

-- 5. Backfill: existing users become admins, keep all data
INSERT INTO public.profiles (id, email, full_name, is_active, created_at)
SELECT u.id, u.email, COALESCE(u.raw_user_meta_data->>'full_name', u.email), true, u.created_at
FROM auth.users u
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::public.app_role FROM auth.users u
ON CONFLICT (user_id, role) DO NOTHING;

-- 6. New users: profile + collaborator role by default
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email))
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'collaborator')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. RLS: profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
FOR SELECT TO authenticated USING (id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles
FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;
CREATE POLICY "Admins can update profiles" ON public.profiles
FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
CREATE POLICY "Admins can insert profiles" ON public.profiles
FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
CREATE POLICY "Admins can delete profiles" ON public.profiles
FOR DELETE TO authenticated USING (public.is_admin(auth.uid()) AND id <> auth.uid());

-- 8. RLS: user_roles (only admins may change roles)
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles" ON public.user_roles
FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
CREATE POLICY "Admins can view all roles" ON public.user_roles
FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
CREATE POLICY "Admins can insert roles" ON public.user_roles
FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
CREATE POLICY "Admins can update roles" ON public.user_roles
FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;
CREATE POLICY "Admins can delete roles" ON public.user_roles
FOR DELETE TO authenticated USING (public.is_admin(auth.uid()) AND user_id <> auth.uid());

-- 9. properties: owner or admin full access; collaborators get no direct row access
DROP POLICY IF EXISTS "Users can view own properties" ON public.properties;
CREATE POLICY "Owners and admins can view properties" ON public.properties
FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can insert own properties" ON public.properties;
CREATE POLICY "Admins can insert properties" ON public.properties
FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can update own properties" ON public.properties;
CREATE POLICY "Owners and admins can update properties" ON public.properties
FOR UPDATE TO authenticated
USING (user_id = auth.uid() OR public.is_admin(auth.uid()))
WITH CHECK (user_id = auth.uid() OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can delete own properties" ON public.properties;
CREATE POLICY "Owners and admins can delete properties" ON public.properties
FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

-- 10. brokers / follow_ups: admin-only creation, owner or admin access
DROP POLICY IF EXISTS "Users can insert own brokers" ON public.brokers;
CREATE POLICY "Admins can insert brokers" ON public.brokers
FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can insert own follow ups" ON public.follow_ups;
CREATE POLICY "Admins can insert follow ups" ON public.follow_ups
FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.is_admin(auth.uid()));

-- 11. Public (non-private) projection for collaborators
DROP VIEW IF EXISTS public.properties_shared;
CREATE VIEW public.properties_shared AS
  SELECT
    p.id,
    p.title,
    p.property_type,
    p.ownership_type,
    p.transaction_type,
    p.status,
    p.city,
    p.phase,
    p.neighborhood,
    p.street,
    p.area,
    p.price,
    p.deposit,
    p.monthly_rent,
    p.bedrooms,
    p.floor,
    p.total_floors,
    p.building_age,
    p.parking,
    p.elevator,
    p.storage,
    p.description,
    p.created_at,
    p.updated_at
  FROM public.properties p
  WHERE public.can_view_shared(auth.uid());

GRANT SELECT ON public.properties_shared TO authenticated;
REVOKE ALL ON public.properties_shared FROM anon;