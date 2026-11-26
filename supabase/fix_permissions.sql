-- Libera leitura pública para as lojas e cupons (necessário para a vitrine pública):
GRANT SELECT ON TABLE public.stores TO anon, authenticated;
GRANT SELECT ON TABLE public.coupons TO anon, authenticated;

-- Habilita RLS e cria política de leitura livre:
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'stores' AND policyname = 'Public read stores'
  ) THEN
    CREATE POLICY "Public read stores" ON public.stores FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'coupons' AND policyname = 'Public read coupons'
  ) THEN
    CREATE POLICY "Public read coupons" ON public.coupons FOR SELECT USING (true);
  END IF;
END $$;
