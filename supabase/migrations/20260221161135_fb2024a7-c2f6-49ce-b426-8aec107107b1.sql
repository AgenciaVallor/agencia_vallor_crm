
-- Add email-specific columns to campaigns
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS assunto_email text NOT NULL DEFAULT '';
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS texto_email text NOT NULL DEFAULT '';
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS usar_ia_email boolean NOT NULL DEFAULT false;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS remetente_nome text NOT NULL DEFAULT 'Vallor Agência';
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS remetente_email text NOT NULL DEFAULT '';
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS anexos_urls text[] NOT NULL DEFAULT '{}';
