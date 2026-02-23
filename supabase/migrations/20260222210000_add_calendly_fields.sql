-- Migration: add Calendly fields to replace Google Calendar

-- Add Calendly fields to agendamentos table
ALTER TABLE public.agendamentos 
  ADD COLUMN IF NOT EXISTS calendly_event_uuid TEXT,
  ADD COLUMN IF NOT EXISTS meeting_link TEXT,
  ADD COLUMN IF NOT EXISTS nome_lead TEXT;

-- Add Calendly config fields to agente_config table
ALTER TABLE public.agente_config
  ADD COLUMN IF NOT EXISTS calendly_token TEXT,
  ADD COLUMN IF NOT EXISTS calendly_event_type_uri TEXT;

-- Add conversation_state to leads for multi-step scheduling flow
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS scheduling_state JSONB;
