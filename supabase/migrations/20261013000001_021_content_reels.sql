/*
# Step 1 (content reels & Create) — migration 021: reels

## What changes
1. **Content reels.** Until now every reel had to be tied to one of the seller's products.
   A reel now has a `kind`:
   - `product` — as before: `product_id` required, seller only, shows "Buy Now".
   - `content` — no product (`product_id` is NULL); ANY signed-in, active user can post one.
   A table CHECK keeps the two shapes from mixing.
   `seller_id` stays the column that holds the uploader's profile id for BOTH kinds
   (it is a plain FK to profiles; a separate `uploader_id` would only duplicate it, and
   every existing policy, index and query already uses `seller_id`).
2. **Hashtags.** `hashtags text[]` (max 10), filled by the app from the caption.
3. **Moderation.** `hidden_by_admin` + `hidden_reason`. An admin can hide a reel without
   deleting it; the owner cannot un-hide it (guard trigger). Hidden reels are invisible to the
   public. An admin hiding / un-hiding / deleting someone else's reel is written to `audit_logs`.
4. **Integrity checks (trigger `reels_validate`, only for a NEW reel or a CHANGED value, so old
   reels stay editable):**
   - `video_url` / `thumbnail_url` must point into the uploader's OWN storage folder, so a reel
     can never embed an arbitrary external link.
   - caption at most 300 characters.
5. **Security fixes found while reading the old reels code**
   - A seller could INSERT a reel with any `like_count` (the old guard from migration 014 only
     covered UPDATE). Now forced to 0 on insert.
   - Only an admin can set `hidden_by_admin` / `hidden_reason`.
6. **Abuse limits (protect the free-plan 1 GB storage).**
   - A non-admin can add at most 10 reels per 24 hours (trigger, clear error message).
   - Storage: at most 30 objects (videos + thumbnails) per user per 24 hours.
7. **Storage (`reel-videos`).** Upload is allowed for any active signed-in user into their OWN
   folder (before: sellers only). The bucket gets a 50 MB file limit (the Supabase free-plan
   maximum) and only accepts mp4 / webm / quicktime / m4v video and jpeg / png / webp thumbnails.
   The tighter app limits (size, 60 seconds) are in `src/lib/reelLimits.ts`; storage cannot check duration.

## Unchanged
Existing reels keep working: they all have `kind = 'product'` and a product.
The like counter, like policies and admin full access are untouched.

## To change a limit later
Daily reel count: `reels_guard()` below (number 10). Daily object count: the
`upload_own_reel_videos` policy (number 30). File size: the `file_size_limit` at the bottom.
*/

-- ============================================================
-- 1. Columns and constraints
-- ============================================================
ALTER TABLE reels ALTER COLUMN product_id DROP NOT NULL;

ALTER TABLE reels
    ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'product',
    ADD COLUMN IF NOT EXISTS hidden_by_admin boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS hidden_reason text,
    ADD COLUMN IF NOT EXISTS hashtags text[] NOT NULL DEFAULT '{}';

ALTER TABLE reels DROP CONSTRAINT IF EXISTS reels_kind_chk;
ALTER TABLE reels ADD CONSTRAINT reels_kind_chk CHECK (kind IN ('product', 'content'));

ALTER TABLE reels DROP CONSTRAINT IF EXISTS reels_kind_product_chk;
ALTER TABLE reels ADD CONSTRAINT reels_kind_product_chk CHECK (
    (kind = 'product' AND product_id IS NOT NULL)
    OR (kind = 'content' AND product_id IS NULL)
);

ALTER TABLE reels DROP CONSTRAINT IF EXISTS reels_hashtags_chk;
ALTER TABLE reels ADD CONSTRAINT reels_hashtags_chk CHECK (cardinality(hashtags) <= 10);

-- (caption length and own-folder URLs are checked in reels_validate() below, not as table
--  CHECKs: a table CHECK is re-evaluated on EVERY update, which would stop a seller from even
--  hiding an old reel whose caption is longer than the new limit.)
ALTER TABLE reels DROP CONSTRAINT IF EXISTS reels_caption_len_chk;
ALTER TABLE reels DROP CONSTRAINT IF EXISTS reels_video_own_folder_chk;
ALTER TABLE reels DROP CONSTRAINT IF EXISTS reels_thumb_own_folder_chk;

CREATE INDEX IF NOT EXISTS idx_reels_kind_created ON reels (kind, created_at DESC);

-- ============================================================
-- 2. Guard: like_count starts at 0; only an admin moderates; daily limit
-- ============================================================
CREATE OR REPLACE FUNCTION reels_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- auth.uid() IS NULL = Supabase dashboard / SQL editor: leave untouched
  IF auth.uid() IS NOT NULL AND NOT is_admin(auth.uid()) THEN
    IF TG_OP = 'INSERT' THEN
      NEW.like_count := 0;
      NEW.hidden_by_admin := false;
      NEW.hidden_reason := NULL;

      IF (SELECT count(*) FROM reels
          WHERE seller_id = auth.uid() AND created_at > now() - interval '24 hours') >= 10 THEN
        RAISE EXCEPTION 'Daily limit reached: you can post up to 10 reels in 24 hours.';
      END IF;
    ELSE
      NEW.hidden_by_admin := OLD.hidden_by_admin;
      NEW.hidden_reason := OLD.hidden_reason;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reels_guard ON reels;
CREATE TRIGGER trg_reels_guard
    BEFORE INSERT OR UPDATE ON reels
    FOR EACH ROW EXECUTE FUNCTION reels_guard();

-- Caption length and "files must be the uploader's own" — checked for a new reel or when the
-- value changes. Dashboard / SQL editor (auth.uid() IS NULL) is exempt so you can fix data by hand.
CREATE OR REPLACE FUNCTION reels_validate()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.caption IS NOT NULL AND char_length(NEW.caption) > 300
     AND (TG_OP = 'INSERT' OR NEW.caption IS DISTINCT FROM OLD.caption) THEN
    RAISE EXCEPTION 'The caption is too long (300 characters at most).';
  END IF;

  IF (TG_OP = 'INSERT' OR NEW.video_url IS DISTINCT FROM OLD.video_url)
     AND NEW.video_url NOT LIKE '%/storage/v1/object/public/reel-videos/' || NEW.seller_id::text || '/%' THEN
    RAISE EXCEPTION 'The video must be uploaded through the site.';
  END IF;

  IF NEW.thumbnail_url IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.thumbnail_url IS DISTINCT FROM OLD.thumbnail_url)
     AND NEW.thumbnail_url NOT LIKE '%/storage/v1/object/public/%/' || NEW.seller_id::text || '/%' THEN
    RAISE EXCEPTION 'The thumbnail must be uploaded through the site.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reels_validate ON reels;
CREATE TRIGGER trg_reels_validate
    BEFORE INSERT OR UPDATE ON reels
    FOR EACH ROW EXECUTE FUNCTION reels_validate();

-- ============================================================
-- 3. RLS
-- ============================================================
-- Owner: full control of OWN reels. A content reel needs no product; a product reel
-- must belong to a seller AND point at that seller's own product.
DROP POLICY IF EXISTS "seller_manage_own_reels" ON reels;
DROP POLICY IF EXISTS "user_manage_own_reels" ON reels;
CREATE POLICY "user_manage_own_reels" ON reels FOR ALL
    TO authenticated
    USING (auth.uid() = seller_id)
    WITH CHECK (
        auth.uid() = seller_id
        AND is_active_user(auth.uid())
        AND (
            (kind = 'content' AND product_id IS NULL)
            OR (
                kind = 'product'
                AND is_seller(auth.uid())
                AND EXISTS (SELECT 1 FROM products p WHERE p.id = product_id AND p.seller_id = auth.uid())
            )
        )
    );

-- Public: active, not hidden by an admin, uploader not blocked, and (for product reels)
-- the product is approved and active.
DROP POLICY IF EXISTS "public_read_active_reels" ON reels;
CREATE POLICY "public_read_active_reels" ON reels FOR SELECT
    TO anon, authenticated
    USING (
        is_active = true
        AND hidden_by_admin = false
        AND is_active_user(seller_id)
        AND (
            kind = 'content'
            OR EXISTS (
                SELECT 1 FROM products p
                WHERE p.id = product_id AND p.status = 'approved' AND p.is_active = true
            )
        )
    );

-- ============================================================
-- 4. Audit: an admin hiding / un-hiding / deleting SOMEONE ELSE'S reel
-- ============================================================
CREATE OR REPLACE FUNCTION audit_reel_moderation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT is_admin(auth.uid()) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.hidden_by_admin IS DISTINCT FROM OLD.hidden_by_admin THEN
      PERFORM log_audit(
        CASE WHEN NEW.hidden_by_admin THEN 'reel.hidden' ELSE 'reel.unhidden' END,
        'reel', NEW.id::text,
        jsonb_build_object('uploader_id', NEW.seller_id, 'reason', NEW.hidden_reason)
      );
    END IF;
    RETURN NEW;
  ELSE
    IF OLD.seller_id <> auth.uid() THEN
      PERFORM log_audit(
        'reel.deleted_by_admin', 'reel', OLD.id::text,
        jsonb_build_object('uploader_id', OLD.seller_id, 'kind', OLD.kind, 'video_url', OLD.video_url)
      );
    END IF;
    RETURN OLD;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_reel_hide ON reels;
CREATE TRIGGER trg_audit_reel_hide
    AFTER UPDATE OF hidden_by_admin ON reels
    FOR EACH ROW EXECUTE FUNCTION audit_reel_moderation();

DROP TRIGGER IF EXISTS trg_audit_reel_delete ON reels;
CREATE TRIGGER trg_audit_reel_delete
    AFTER DELETE ON reels
    FOR EACH ROW EXECUTE FUNCTION audit_reel_moderation();

-- ============================================================
-- 5. Storage: reel-videos
-- Thumbnails of reels now go into this bucket too (the old product-images bucket only
-- accepts sellers, and any user can now post a reel).
-- ============================================================
DROP POLICY IF EXISTS "seller_upload_own_reel_videos" ON storage.objects;
DROP POLICY IF EXISTS "upload_own_reel_videos" ON storage.objects;
CREATE POLICY "upload_own_reel_videos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'reel-videos'
  AND is_active_user(auth.uid())
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND (
    is_admin(auth.uid())
    OR (
      SELECT count(*) FROM storage.objects o
      WHERE o.bucket_id = 'reel-videos'
        AND (storage.foldername(o.name))[1] = auth.uid()::text
        AND o.created_at > now() - interval '24 hours'
    ) < 30
  )
);

UPDATE storage.buckets
SET file_size_limit = 52428800,  -- 50 MB (Supabase free-plan maximum)
    allowed_mime_types = ARRAY[
      'video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v',
      'image/jpeg', 'image/png', 'image/webp'
    ]
WHERE id = 'reel-videos';
