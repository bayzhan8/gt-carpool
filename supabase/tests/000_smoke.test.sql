begin;

create extension if not exists pgtap with schema extensions;

select plan(1);
select has_schema('public', 'R-VIS-4 public schema exists for RPCs.');
select * from finish();

rollback;
