-- Backfill centro_custo_id for existing diarias_temporarias rows.
update diarias_temporarias dt
set centro_custo_id = coalesce(
  (
    select ps.cost_center_id
    from postos_servico ps
    where ps.id = dt.posto_servico_id
  ),
  (
    select c.convenia_cost_center_id
    from clientes c
    where c.id = dt.cliente_id
  )
)
where dt.centro_custo_id is null
   or dt.centro_custo_id = '';
