-- Utility function to expose profile names for UI mapping (bypasses RLS safely)
create or replace function public.get_profiles_names(p_ids uuid[])
returns table(id uuid, full_name text)
language sql
security definer
set search_path = public
as $$
  select id, full_name
  from public.profiles
  where p_ids is not null
    and array_length(p_ids, 1) is not null
    and id = any (p_ids);
$$;

grant execute on function public.get_profiles_names(uuid[]) to authenticated;
