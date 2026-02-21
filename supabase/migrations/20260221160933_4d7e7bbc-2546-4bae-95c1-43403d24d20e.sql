
-- Add tipo column to campaigns
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'whatsapp';

-- Email campaign stats for daily limit tracking
CREATE TABLE IF NOT EXISTS public.email_campaign_stats (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  data date NOT NULL DEFAULT CURRENT_DATE,
  total_enviados integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, data)
);
ALTER TABLE public.email_campaign_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own email stats" ON public.email_campaign_stats FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Email logs
CREATE TABLE IF NOT EXISTS public.email_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  lead_id uuid NOT NULL,
  campaign_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  assunto text NOT NULL DEFAULT '',
  enviado_em timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own email logs" ON public.email_logs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Storage bucket for email attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('email-attachments', 'email-attachments', false) ON CONFLICT DO NOTHING;

CREATE POLICY "Users can upload email attachments" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'email-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can view own email attachments" ON storage.objects FOR SELECT USING (bucket_id = 'email-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own email attachments" ON storage.objects FOR DELETE USING (bucket_id = 'email-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
