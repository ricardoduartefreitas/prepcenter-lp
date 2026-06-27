-- Tabela de leads do Prep Center
-- Aplicada via MCP Supabase em 2026-06-27 no projeto rfaskndtdixdhpdwrydy

create table if not exists prepcenter_leads (
  id uuid default gen_random_uuid() primary key,
  nome text not null,
  whatsapp text not null,
  volume text not null,
  marketplace text not null,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  lgpd_consent boolean default false,
  turnstile_validated boolean default false,
  n8n_notified boolean default false,
  created_at timestamptz default now()
);

alter table prepcenter_leads enable row level security;
-- Sem policies públicas = nenhum acesso anônimo
-- Edge Function usa service_role key (bypassa RLS)
