# Bahagia

## Production setup

1. Run `supabase-schema.sql` in the Supabase SQL Editor.
2. Run `quality-migration.sql`, then `production-security.sql`.
3. Put only the Supabase URL and anon/publishable key in `config.js`; never use a service-role key in browser code.
4. Keep the `ebooks` Storage bucket private. The reader uses short-lived signed URLs.
5. Configure Auth email/Google providers and production redirect URLs.
6. Register an account and promote it to admin from SQL:

```sql
update public.profiles set role = 'admin' where email = 'your-admin@example.com';
```

RLS and Storage policies enforce ownership on the server. The local mode remains available for demonstrations only and must not be treated as production authentication or persistence.

See `PRODUCTION-CHECKLIST.md` for verification steps.
