
CREATE TABLE IF NOT EXISTS public.agente_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  nome_agente text NOT NULL DEFAULT 'Hunter',
  estilo text NOT NULL DEFAULT 'Humano',
  descricao_produto text NOT NULL DEFAULT '',
  nicho text NOT NULL DEFAULT '',
  missao text NOT NULL DEFAULT '',
  agressividade integer NOT NULL DEFAULT 5,
  objecoes text[] NOT NULL DEFAULT '{}',
  argumentos text[] NOT NULL DEFAULT '{}',
  system_prompt text NOT NULL DEFAULT ''
);

ALTER TABLE public.agente_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on agente_config"
  ON public.agente_config
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER update_agente_config_updated_at
  BEFORE UPDATE ON public.agente_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default config
INSERT INTO public.agente_config (nome_agente, estilo, descricao_produto, nicho, missao, agressividade, objecoes, argumentos, system_prompt)
VALUES (
  'Hunter',
  'Humano',
  '',
  '',
  '',
  5,
  ARRAY[]::text[],
  ARRAY[]::text[],
  ''
);
