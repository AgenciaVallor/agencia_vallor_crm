
-- Add new columns to leads table
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS instagram text DEFAULT NULL;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS linkedin text DEFAULT NULL;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS endereco text DEFAULT NULL;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS observacoes text DEFAULT NULL;
