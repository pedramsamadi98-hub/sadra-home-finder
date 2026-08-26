-- Revoke EXECUTE from the anon role on all SECURITY DEFINER functions.
-- These functions enforce internal authorization (auth.uid() checks or trigger context)
-- and must not be callable by unauthenticated callers.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_view_shared(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.photo_is_public_listing(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.shared_properties() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;

-- Belt-and-braces: revoke from PUBLIC so no future role inherits access implicitly.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;

-- Re-grant to authenticated where signed-in users legitimately call these via RLS/RPC.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_shared(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.photo_is_public_listing(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.shared_properties() TO authenticated;