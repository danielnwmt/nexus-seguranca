CREATE TABLE public.bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  description text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  amount numeric NOT NULL DEFAULT 0,
  due_date date,
  paid_at date,
  status text NOT NULL DEFAULT 'pending',
  supplier text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can CRUD bills"
  ON public.bills FOR ALL
  USING (public.is_authenticated())
  WITH CHECK (public.is_authenticated());

CREATE TRIGGER handle_bills_updated_at
  BEFORE UPDATE ON public.bills
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();