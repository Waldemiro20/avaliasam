-- AvaliaSAM: execute uma vez no Supabase (SQL Editor → New query → Run).

-- Dados compartilhados: eventos, avaliadores, votos e notas.
create table if not exists public.avaliasam_kv (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- RLS ligado e sem políticas: só o servidor (service_role) acessa a tabela.
alter table public.avaliasam_kv enable row level security;

-- Arquivos dos projetos (PDFs, slides). Público para leitura: os caminhos têm um UUID aleatório.
insert into storage.buckets (id, name, public)
values ('avaliasam-files', 'avaliasam-files', true)
on conflict (id) do update set public = true;
