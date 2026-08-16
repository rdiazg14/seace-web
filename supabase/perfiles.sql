-- =====================================================================
-- seace-web · perfiles + es_admin + RLS + trigger
-- Ejecutar en: Supabase → SQL Editor → Run.
-- Idempotente. No toca contratos, chunks_tdr ni RPCs de búsqueda.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.perfiles (
  id          uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email       text NOT NULL,
  rol         text NOT NULL CHECK (rol IN ('admin', 'normal')),
  creado_por  uuid REFERENCES public.perfiles (id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS perfiles_email_idx ON public.perfiles (email);
CREATE INDEX IF NOT EXISTS perfiles_rol_idx ON public.perfiles (rol);

COMMENT ON TABLE public.perfiles IS
  'Perfil de la app. El rol NO vive en el cliente; RLS impide que un usuario se auto-promueva.';
COMMENT ON COLUMN public.perfiles.rol IS 'admin | normal. Solo lo escribe service_role (EF) o un admin vía RLS.';
COMMENT ON COLUMN public.perfiles.creado_por IS 'Admin que dio de alta al usuario. NULL en el bootstrap.';

-- ---------------------------------------------------------------------
-- es_admin(): lee perfiles sin recursar RLS (SECURITY DEFINER).
-- No acepta uid por argumento: solo auth.uid() del JWT.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.es_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.perfiles
    WHERE id = auth.uid()
      AND rol = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.es_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.es_admin() TO authenticated;

-- ---------------------------------------------------------------------
-- Trigger: todo user de Auth obtiene fila en perfiles.
-- rol sale de app_metadata (solo service_role lo escribe). Default: normal.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  nuevo_rol text;
BEGIN
  nuevo_rol := COALESCE(NEW.raw_app_meta_data->>'rol', 'normal');
  IF nuevo_rol NOT IN ('admin', 'normal') THEN
    nuevo_rol := 'normal';
  END IF;

  INSERT INTO public.perfiles (id, email, rol)
  VALUES (NEW.id, COALESCE(NEW.email, ''), nuevo_rol)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfiles FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS perfiles_select ON public.perfiles;
CREATE POLICY perfiles_select ON public.perfiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.es_admin());

DROP POLICY IF EXISTS perfiles_update ON public.perfiles;
CREATE POLICY perfiles_update ON public.perfiles
  FOR UPDATE TO authenticated
  USING (public.es_admin())
  WITH CHECK (public.es_admin());

DROP POLICY IF EXISTS perfiles_delete ON public.perfiles;
CREATE POLICY perfiles_delete ON public.perfiles
  FOR DELETE TO authenticated
  USING (public.es_admin());

-- Sin policy INSERT para authenticated: solo el trigger (definer) inserta.

REVOKE ALL ON TABLE public.perfiles FROM PUBLIC, anon;
GRANT SELECT, UPDATE, DELETE ON TABLE public.perfiles TO authenticated;

-- ---------------------------------------------------------------------
-- Verificación
-- ---------------------------------------------------------------------
SELECT
  (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public' AND tablename = 'perfiles') AS tabla_ok,
  (SELECT COUNT(*) FROM pg_proc WHERE proname = 'es_admin') AS fn_admin_ok,
  (SELECT COUNT(*) FROM pg_trigger WHERE tgname = 'on_auth_user_created') AS trigger_ok;
