
-- Create campaigns table
CREATE TABLE public.campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  nome TEXT NOT NULL DEFAULT '',
  nicho_filtro TEXT NOT NULL DEFAULT '',
  cidade_filtro TEXT NOT NULL DEFAULT '',
  estado_filtro TEXT NOT NULL DEFAULT '',
  delay_segundos INTEGER NOT NULL DEFAULT 120,
  quantidade_por_dia INTEGER NOT NULL DEFAULT 30,
  status TEXT NOT NULL DEFAULT 'pausada',
  total_enviados INTEGER NOT NULL DEFAULT 0,
  total_leads INTEGER NOT NULL DEFAULT 0
);

-- Create campaign_messages table
CREATE TABLE public.campaign_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  mensagem TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pendente',
  enviado_em TIMESTAMP WITH TIME ZONE,
  resposta TEXT,
  respondido_em TIMESTAMP WITH TIME ZONE,
  pausado_por_humano BOOLEAN NOT NULL DEFAULT false
);

-- Enable RLS
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_messages ENABLE ROW LEVEL SECURITY;

-- Permissive policies (same pattern as existing tables)
CREATE POLICY "Allow all operations on campaigns"
  ON public.campaigns FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations on campaign_messages"
  ON public.campaign_messages FOR ALL
  USING (true)
  WITH CHECK (true);

-- Triggers for updated_at
CREATE TRIGGER update_campaigns_updated_at
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
