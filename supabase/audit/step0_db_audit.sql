-- Step 0 audit: READ-ONLY checks. Safe to run in the Supabase SQL Editor; it changes nothing.
-- Run each block and compare with the expected result in the comment above it.

-- 1) Tables in `public` WITHOUT row level security. Expected: 0 rows.
SELECT c.relname AS table_without_rls
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity
ORDER BY 1;

-- 2) Every policy (to compare with the migrations). Expected: a policy list that matches 001-020.
SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 3) Tables that have RLS on but NO policy at all (nobody but admin/service can use them). Review each row.
SELECT c.relname AS rls_on_but_no_policy
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
  AND NOT EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = c.relname)
ORDER BY 1;

-- 4) SECURITY DEFINER functions without a pinned search_path. Expected: 0 rows (after migration 020).
SELECT p.proname AS definer_function_without_search_path
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.prosecdef
  AND coalesce(p.proconfig::text, '') NOT LIKE '%search_path%'
ORDER BY 1;

-- 5) Which migrations have really been run? Each row should say true.
SELECT t AS expected_table, to_regclass('public.' || t) IS NOT NULL AS exists_in_db
FROM unnest(ARRAY[
  'profiles','seller_profiles','products','commission_settings','delivery_zones','reels',
  'orders','order_items','order_notifications','reel_likes','categories',
  'payment_methods','seller_payouts','seller_payout_accounts','audit_logs'
]) AS t;

-- 6) Storage buckets. Expected: product-images (public), reel-videos (public), seller-kyc (PRIVATE).
SELECT id, public FROM storage.buckets ORDER BY id;

-- 7) The old direct-insert policies must be gone. Expected: 0 rows.
SELECT tablename, policyname FROM pg_policies
WHERE schemaname = 'public'
  AND policyname IN ('customer_insert_own_orders', 'customer_insert_own_order_items');

-- 8) Admin accounts. Expected: only people you know.
SELECT email, role, is_active FROM profiles WHERE role = 'admin';

-- 9) Reel video sizes (14চ-৪). Heavy videos are one of the main reasons reels load slowly.
--    Read the numbers, then decide the upload size limit for Phase 1 (Create page).
SELECT count(*) AS videos,
       round(avg((metadata->>'size')::numeric) / 1048576, 1) AS avg_mb,
       round(max((metadata->>'size')::numeric) / 1048576, 1) AS max_mb,
       count(*) FILTER (WHERE (metadata->>'size')::numeric > 10 * 1048576) AS over_10_mb,
       count(*) FILTER (WHERE (metadata->>'size')::numeric > 25 * 1048576) AS over_25_mb
FROM storage.objects
WHERE bucket_id = 'reel-videos' AND name !~* '\.(jpe?g|png|webp)$';

-- 9b) The 10 heaviest reel videos
SELECT name, round((metadata->>'size')::numeric / 1048576, 1) AS mb, metadata->>'mimetype' AS type
FROM storage.objects
WHERE bucket_id = 'reel-videos' AND name !~* '\.(jpe?g|png|webp)$'
ORDER BY (metadata->>'size')::numeric DESC NULLS LAST
LIMIT 10;

-- 10) Step 1 check (after running migrations 021 and 022). Every row should say true.
SELECT 'reels.kind / hashtags / hidden_by_admin' AS item,
       (SELECT count(*) FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'reels'
          AND column_name IN ('kind', 'hashtags', 'hidden_by_admin', 'hidden_reason')) = 4 AS ok
UNION ALL SELECT 'reels.product_id is nullable',
       (SELECT is_nullable = 'YES' FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'reels' AND column_name = 'product_id')
UNION ALL SELECT 'profiles.username',
       EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'username')
UNION ALL SELECT 'reel + profile guard triggers',
       (SELECT count(*) FROM pg_trigger
        WHERE tgname IN ('trg_reels_guard', 'trg_reels_validate', 'trg_profiles_self_guard')) = 3
UNION ALL SELECT 'public creator functions',
       (SELECT count(*) FROM pg_proc WHERE proname IN ('public_creator_names', 'public_creator_profile')) = 2
UNION ALL SELECT 'reel-videos bucket limit 50 MB',
       EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'reel-videos' AND file_size_limit = 52428800);
