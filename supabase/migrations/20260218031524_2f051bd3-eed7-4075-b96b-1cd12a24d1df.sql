
-- Create leads table for AF Hunter dashboard
CREATE TABLE public.leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome_empresa TEXT NOT NULL,
  nicho TEXT NOT NULL,
  cidade TEXT NOT NULL,
  estado TEXT NOT NULL,
  whatsapp TEXT,
  email TEXT,
  site TEXT,
  telefone TEXT,
  temperatura TEXT NOT NULL DEFAULT 'Frio' CHECK (temperatura IN ('Fervendo', 'Quente', 'Morno', 'Frio', 'Desinteressado')),
  fonte TEXT NOT NULL DEFAULT 'Google Maps simulado',
  status_funil TEXT NOT NULL DEFAULT 'Novo',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Allow public access for this demo (no auth required)
CREATE POLICY "Allow all operations on leads"
  ON public.leads
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
