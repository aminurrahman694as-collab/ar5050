# Multi-Vendor E-commerce Platform (AR Traders)

Stack: React + Vite + Tailwind CSS + Supabase (hosted on Vercel)

## What's built
- **Auth & roles:** admin / seller / customer, Become a Seller with NID KYC.
- **Shopping:** TikTok-style home feed (reels + products), Shop with category grid and sub-categories,
  product pages, Cart (localStorage), multi-item Checkout, My Orders.
- **Payments:** Cash on Delivery, or manual bKash / Nagad / Rocket / bank transfer to the platform's accounts
  (customer enters a Transaction ID; admin verifies). Admin manages the methods under *Payment Methods*.
- **Sellers:** analytics, products, reels, payouts and payout account.
- **Admin panel:** sellers, products, approvals, orders (payment verify/reject), commission, delivery zones,
  payment methods, seller payouts.
- **Info pages:** Contact, Shop FAQ, Terms & Conditions.
- **Reel sound:** reels start muted (browser rule) and switch to sound automatically after the first tap;
  a deliberate mute is remembered on the device.
- **Reel player:** one video plays at a time (a short delay stops reels flung past during a fast swipe from
  making sound); only the reel on screen and the next one preload, the previous one loads metadata only and
  the rest release their video data; on a slow connection, or while the reel on screen is buffering,
  neighbours stop downloading. Shared by the home feed and `/reels` (`useActiveSlide`, `lib/reelPlayback.ts`).
- **Create & content reels (Step 1):** anyone signed in can post a reel at `/create` (＋ in the bottom bar); sellers can
  also link one of their approved products (Buy Now bar). Videos: MP4/WebM/MOV, up to 60 s and 25 MB (change in
  `src/lib/reelLimits.ts`), real upload progress, auto thumbnail, retry without re-uploading, max 10 reels per day.
  Creators pick a `@username` (migration 022); public page at `/u/:username` (404 if unknown or blocked), `/profile`
  opens your own. Admin: **Reels Review** (hide / show again / delete, all recorded in the audit log). Deleting a reel
  also deletes its files from storage.
- **Audit log:** `audit_logs` (append-only, admin-read only) records payment-status changes and seller payouts.

## Supabase migrations
Run every file in `supabase/migrations/` in filename order in the SQL Editor
(`001` ... `022`). Edge Function `notify-seller` emails sellers on new orders and needs SMTP secrets
(see the comment at the top of `supabase/functions/notify-seller/index.ts`).
Demo data for testing: `supabase/seed/demo_data.sql`.
`supabase/audit/step0_db_audit.sql` holds read-only checks (RLS, policies, buckets) to run against the live database.

## Getting started

```bash
npm install
cp .env.example .env   # fill in your Supabase project URL + anon key
npm run dev
```

## Still to do
SMS notifications, courier integration (Pathao / Steadfast / RedX), card payments, n8n automation and
social auto-posting, monetization, real reel comments, final testing and domain move.
Brand name and contact details live in `src/lib/brand.ts`.
