# Production deployment checklist

## Required order

1. Run `supabase-schema.sql`.
2. Run `quality-migration.sql`.
3. Run `production-security.sql`.
4. Set `supabaseUrl`, `supabaseAnonKey`, and `storageBucket` in `config.js`.
5. Configure Supabase Auth redirect URLs for the deployed origin.
6. Create the first account, then promote it with SQL:

```sql
update public.profiles
set role = 'admin'
where email = 'your-admin@example.com';
```

## Security requirements

- Use only the anon/publishable key in browser code; never use `service_role`.
- Keep the `ebooks` bucket private.
- Test owner, second-user, and admin sessions separately.
- Confirm a second user cannot update/delete another user's ebook or storage object.
- Confirm a public ebook can be opened through a signed URL.
- Do not use local demo mode for production data. Local demo passwords are intentionally not a production authentication system.

## Important limitation

No frontend-only application can guarantee “100% perfect” behavior across every browser and external viewer. Production readiness depends on applying the SQL migrations, configuring Auth/Storage correctly, and testing the deployed Supabase project.
