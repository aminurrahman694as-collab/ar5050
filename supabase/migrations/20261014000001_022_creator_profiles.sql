/*
# Step 1 (creator profiles) — migration 022: usernames

## What changes
1. `profiles.username` — unique (case-insensitive by construction: only lowercase letters,
   digits and `_`, 3–20 characters), used in `/u/:username`. NULL until the user picks one;
   the Create page asks for it before the first post. A handful of reserved names that could
   be used to pose as the site or its staff are refused for ordinary users.
2. Two public read functions (profiles itself stays private to its owner and admins):
   - `public_creator_names(ids)` -> id, username, shop_name (shown under a reel).
   - `public_creator_profile(username)` -> id, username, shop_name, reel and like totals,
     or no row when the user does not exist / is blocked (the page shows a 404).
   Neither returns an email, phone, real name or role.
3. **Security fix — a blocked user could unblock themselves.** The policy
   `users_update_own_profile` lets a user update their own row, and nothing stopped them from
   setting `is_active = true` (or rewriting `email`). A guard trigger now keeps both fields as
   they were for ordinary in-app requests. Admins and the Supabase dashboard (no auth.uid())
   are unaffected, so blocking/unblocking from the admin panel still works.
*/

-- ============================================================
-- 1. username
-- ============================================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username text;

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_username_format_chk;
ALTER TABLE profiles ADD CONSTRAINT profiles_username_format_chk
    CHECK (username IS NULL OR username ~ '^[a-z0-9_]{3,20}$');

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username ON profiles (username) WHERE username IS NOT NULL;

-- ============================================================
-- 2. Guard: is_active / email cannot be changed by the user; reserved usernames
-- ============================================================
CREATE OR REPLACE FUNCTION profiles_self_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Dashboard / SQL editor (no auth.uid()) and admins: leave untouched
  IF auth.uid() IS NULL OR is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    NEW.is_active := OLD.is_active;
    NEW.email := OLD.email;
  END IF;

  IF NEW.username IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.username IS DISTINCT FROM OLD.username)
     AND NEW.username = ANY (ARRAY[
       'admin', 'administrator', 'root', 'support', 'help', 'official', 'moderator', 'staff',
       'artraders', 'ar_traders', 'artreaders', 'ar_readers', 'system', 'null', 'undefined'
     ]) THEN
    RAISE EXCEPTION 'This username is reserved. Please choose another one.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_self_guard ON profiles;
CREATE TRIGGER trg_profiles_self_guard
    BEFORE INSERT OR UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION profiles_self_guard();

-- ============================================================
-- 3. Public read functions
-- ============================================================
CREATE OR REPLACE FUNCTION public_creator_names(p_ids uuid[])
RETURNS TABLE (id uuid, username text, shop_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.username, sp.shop_name
  FROM profiles p
  LEFT JOIN seller_profiles sp ON sp.id = p.id
  WHERE p.id = ANY (p_ids[1:200]) AND p.is_active;
$$;

REVOKE ALL ON FUNCTION public_creator_names(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public_creator_names(uuid[]) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public_creator_profile(p_username text)
RETURNS TABLE (id uuid, username text, shop_name text, reel_count bigint, like_total bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.username,
    sp.shop_name,
    COALESCE(r.cnt, 0),
    COALESCE(r.likes, 0)
  FROM profiles p
  LEFT JOIN seller_profiles sp ON sp.id = p.id
  LEFT JOIN LATERAL (
    SELECT count(*) AS cnt, COALESCE(sum(rl.like_count), 0) AS likes
    FROM reels rl
    WHERE rl.seller_id = p.id
      AND rl.is_active = true
      AND rl.hidden_by_admin = false
      AND (
        rl.kind = 'content'
        OR EXISTS (SELECT 1 FROM products pr WHERE pr.id = rl.product_id AND pr.status = 'approved' AND pr.is_active = true)
      )
  ) r ON true
  WHERE p.username = lower(p_username) AND p.is_active;
$$;

REVOKE ALL ON FUNCTION public_creator_profile(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public_creator_profile(text) TO anon, authenticated;
