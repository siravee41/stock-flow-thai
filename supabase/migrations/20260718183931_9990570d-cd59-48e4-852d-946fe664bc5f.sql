
-- =============== ENUMS ===============
CREATE TYPE public.app_role AS ENUM ('owner', 'manager', 'staff', 'warehouse');
CREATE TYPE public.movement_type AS ENUM ('IN', 'OUT', 'TRANSFER');

-- =============== PROFILES ===============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Auto create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============== BRANCHES ===============
CREATE TABLE public.branches (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  short_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.branches TO authenticated;
GRANT ALL ON public.branches TO service_role;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "branches_select_all_auth" ON public.branches FOR SELECT TO authenticated USING (true);

-- =============== USER ROLES ===============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  branch_id TEXT REFERENCES public.branches(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role, branch_id)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_owner(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'owner');
$$;

CREATE OR REPLACE FUNCTION public.user_branch_ids(_user_id UUID)
RETURNS TABLE(branch_id TEXT) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT branch_id FROM public.user_roles WHERE user_id = _user_id AND branch_id IS NOT NULL;
$$;

CREATE POLICY "user_roles_select_own" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_owner(auth.uid()));
CREATE POLICY "user_roles_owner_manage" ON public.user_roles FOR ALL TO authenticated
  USING (public.is_owner(auth.uid())) WITH CHECK (public.is_owner(auth.uid()));

-- =============== PRODUCTS ===============
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'ชิ้น',
  category TEXT,
  min_stock NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products_select_all_auth" ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "products_owner_manage" ON public.products FOR ALL TO authenticated
  USING (public.is_owner(auth.uid()) OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.is_owner(auth.uid()) OR public.has_role(auth.uid(),'manager'));

-- =============== STOCK BALANCES ===============
CREATE TABLE public.stock_balances (
  branch_id TEXT NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (branch_id, product_id)
);
GRANT SELECT ON public.stock_balances TO authenticated;
GRANT ALL ON public.stock_balances TO service_role;
ALTER TABLE public.stock_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stock_balances_select_auth" ON public.stock_balances FOR SELECT TO authenticated USING (true);

-- =============== STOCK MOVEMENTS ===============
CREATE TABLE public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type movement_type NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  product_name TEXT NOT NULL,
  branch_id TEXT NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  from_branch_id TEXT REFERENCES public.branches(id),
  to_branch_id TEXT REFERENCES public.branches(id),
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  quantity_before NUMERIC NOT NULL,
  quantity_after NUMERIC NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_by_name TEXT NOT NULL
);
GRANT SELECT, INSERT ON public.stock_movements TO authenticated;
GRANT ALL ON public.stock_movements TO service_role;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stock_movements_select_auth" ON public.stock_movements FOR SELECT TO authenticated USING (true);

CREATE INDEX idx_movements_created_at ON public.stock_movements(created_at DESC);
CREATE INDEX idx_movements_branch ON public.stock_movements(branch_id);
CREATE INDEX idx_movements_product ON public.stock_movements(product_id);

-- =============== ATOMIC RPC: stock movement ===============
CREATE OR REPLACE FUNCTION public.perform_stock_movement(
  _type movement_type,
  _product_id UUID,
  _branch_id TEXT,
  _to_branch_id TEXT,
  _quantity NUMERIC,
  _note TEXT
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid UUID := auth.uid();
  _uname TEXT;
  _pname TEXT;
  _before NUMERIC;
  _after NUMERIC;
  _before_to NUMERIC;
  _after_to NUMERIC;
  _mov_id UUID;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF _quantity IS NULL OR _quantity <= 0 THEN RAISE EXCEPTION 'quantity_must_be_positive'; END IF;

  -- Authorization: owner OR user has a role at this branch
  IF NOT (public.is_owner(_uid)
          OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _uid AND (branch_id = _branch_id OR role = 'warehouse'))) THEN
    RAISE EXCEPTION 'forbidden_branch';
  END IF;

  SELECT COALESCE(name, split_part(email,'@',1)) INTO _uname FROM public.profiles WHERE id = _uid;
  SELECT name INTO _pname FROM public.products WHERE id = _product_id;
  IF _pname IS NULL THEN RAISE EXCEPTION 'product_not_found'; END IF;

  -- Ensure balance row exists (source)
  INSERT INTO public.stock_balances (branch_id, product_id, quantity)
    VALUES (_branch_id, _product_id, 0)
    ON CONFLICT (branch_id, product_id) DO NOTHING;

  SELECT quantity INTO _before FROM public.stock_balances
    WHERE branch_id = _branch_id AND product_id = _product_id FOR UPDATE;

  IF _type = 'IN' THEN
    _after := _before + _quantity;
    UPDATE public.stock_balances SET quantity = _after, updated_at = now()
      WHERE branch_id = _branch_id AND product_id = _product_id;

    INSERT INTO public.stock_movements (type, product_id, product_name, branch_id, quantity, quantity_before, quantity_after, note, created_by, created_by_name)
      VALUES ('IN', _product_id, _pname, _branch_id, _quantity, _before, _after, _note, _uid, COALESCE(_uname,'user'))
      RETURNING id INTO _mov_id;

  ELSIF _type = 'OUT' THEN
    IF _before < _quantity THEN RAISE EXCEPTION 'insufficient_stock'; END IF;
    _after := _before - _quantity;
    UPDATE public.stock_balances SET quantity = _after, updated_at = now()
      WHERE branch_id = _branch_id AND product_id = _product_id;

    INSERT INTO public.stock_movements (type, product_id, product_name, branch_id, quantity, quantity_before, quantity_after, note, created_by, created_by_name)
      VALUES ('OUT', _product_id, _pname, _branch_id, _quantity, _before, _after, _note, _uid, COALESCE(_uname,'user'))
      RETURNING id INTO _mov_id;

  ELSIF _type = 'TRANSFER' THEN
    IF _to_branch_id IS NULL OR _to_branch_id = _branch_id THEN RAISE EXCEPTION 'invalid_destination'; END IF;
    IF _before < _quantity THEN RAISE EXCEPTION 'insufficient_stock'; END IF;
    _after := _before - _quantity;
    UPDATE public.stock_balances SET quantity = _after, updated_at = now()
      WHERE branch_id = _branch_id AND product_id = _product_id;

    INSERT INTO public.stock_balances (branch_id, product_id, quantity)
      VALUES (_to_branch_id, _product_id, 0)
      ON CONFLICT (branch_id, product_id) DO NOTHING;
    SELECT quantity INTO _before_to FROM public.stock_balances
      WHERE branch_id = _to_branch_id AND product_id = _product_id FOR UPDATE;
    _after_to := _before_to + _quantity;
    UPDATE public.stock_balances SET quantity = _after_to, updated_at = now()
      WHERE branch_id = _to_branch_id AND product_id = _product_id;

    INSERT INTO public.stock_movements (type, product_id, product_name, branch_id, from_branch_id, to_branch_id, quantity, quantity_before, quantity_after, note, created_by, created_by_name)
      VALUES ('TRANSFER', _product_id, _pname, _branch_id, _branch_id, _to_branch_id, _quantity, _before, _after, _note, _uid, COALESCE(_uname,'user'))
      RETURNING id INTO _mov_id;
  ELSE
    RAISE EXCEPTION 'invalid_type';
  END IF;

  RETURN _mov_id;
END;
$$;

REVOKE ALL ON FUNCTION public.perform_stock_movement(movement_type, UUID, TEXT, TEXT, NUMERIC, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.perform_stock_movement(movement_type, UUID, TEXT, TEXT, NUMERIC, TEXT) TO authenticated;

-- =============== Realtime ===============
ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_balances;
ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_movements;
ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
ALTER PUBLICATION supabase_realtime ADD TABLE public.branches;

-- =============== Seed branches ===============
INSERT INTO public.branches (id, name, short_name) VALUES
  ('central-kitchen', 'Central Kitchen', 'ครัวกลาง'),
  ('yukata-shabu', 'Yukata Shabu', 'ยูกาตะ'),
  ('hongdae-bbq', 'HongDae Korean BBQ', 'ฮงแด'),
  ('yokoya-izakaya', 'Yokoya Izakaya', 'โยโกย่า');
