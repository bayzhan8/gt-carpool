alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated;

alter default privileges for role postgres in schema app
  revoke execute on functions from anon, authenticated;
