-- 공유 링크로 특정 공개 퍼즐을 안전하게 불러옵니다.
create or replace function public.get_puzzle_by_number(target_puzzle_no bigint)
returns table (
  id uuid,
  puzzle_no bigint,
  difficulty public.puzzle_difficulty,
  rows smallint,
  cols smallint,
  row_hints jsonb,
  column_hints jsonb
)
language sql
security definer
set search_path = public
stable
as $$
  select p.id, p.puzzle_no, p.difficulty, p.rows, p.cols, p.row_hints, p.column_hints
  from public.puzzles p
  where p.puzzle_no = target_puzzle_no and p.status = 'published'
  limit 1;
$$;
revoke all on function public.get_puzzle_by_number(bigint) from public;
grant execute on function public.get_puzzle_by_number(bigint) to anon, authenticated;
