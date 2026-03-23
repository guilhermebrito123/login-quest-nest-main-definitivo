-- =========================================================
-- NOTIFICAR NOVA DIARIA TEMPORARIA (INSERT)
-- =========================================================

create or replace function public.notificar_nova_diaria_temporaria()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_titulo text;
  v_mensagem text;
begin
  if tg_op <> 'INSERT' then
    return new;
  end if;

  for v_user_id in
    select user_id from public.obter_usuarios_envolvidos_diaria(new, new)
  loop
    v_titulo := 'Nova diaria cadastrada';
    v_mensagem := 'A diaria #' || new.id ||
                  ' foi cadastrada e esta com status "' ||
                  coalesce(new.status::text, 'Aguardando confirmacao') || '".';
    perform public.criar_notificacao_diaria(
      new.id, v_user_id, 'status', 'nova_diaria',
      null, new.status::text, v_titulo, v_mensagem
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_notificar_nova_diaria
on public.diarias_temporarias;

create trigger trg_notificar_nova_diaria
after insert on public.diarias_temporarias
for each row
execute function public.notificar_nova_diaria_temporaria();
