begin;

-- Permite que o colaborador solicitante de um chamado leia o usuario
-- que resolveu esse chamado, para exibir o full_name do resolvedor.
drop policy if exists "Solicitante colaborador pode ler resolvedor do chamado" on public.usuarios;

create policy "Solicitante colaborador pode ler resolvedor do chamado"
on public.usuarios
for select
to authenticated
using (
  exists (
    select 1
    from public.chamados c
    where c.resolvido_por = usuarios.id
      and c.solicitante_id = auth.uid()
      and public.is_colaborador_user(auth.uid())
  )
);

commit;
