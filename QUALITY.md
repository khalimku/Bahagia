# Webook Bahagia — production quality notes

## Quality improvements

- `app-quality.js` adds validated drag-and-drop uploads, client-side library search, active navigation state, accessible reader hardening, and visible async error handling.
- `quality-migration.sql` adds query indexes and fixes private Storage reads for public ebooks: readers can receive signed URLs only when the corresponding ebook is marked public.
- The migration is additive and safe to run after `supabase-schema.sql`.

## Deployment checklist

1. Run `supabase-schema.sql`, then `quality-migration.sql` in the Supabase SQL Editor.
2. Keep the bucket private and use only the browser-safe anon/publishable key in `config.js`.
3. Configure production redirect URLs for email confirmation, password reset, and Google OAuth.
4. Do not use local demo mode for real user data; local credentials are intentionally demo-only.
5. Verify RLS with both an owner and a second authenticated user before publishing.
