# মালিকের ম্যানুয়াল কাজ (এজেন্ট এগুলো করতে পারে না)

## 🔴 এখনই (অটোপাইলট চালানোর আগে)
- [ ] Steadfast: পুরোনো key Revoke করে নতুন key তৈরি
- [ ] Pathao: Client Secret/পাসওয়ার্ড রিসেট
- [ ] ফোনের গ্যালারি ও চ্যাট থেকে key-এর স্ক্রিনশট মুছুন
- [ ] সিক্রেট বসান: `supabase secrets set STEADFAST_API_KEY=… PATHAO_CLIENT_SECRET=…` (কখনো `VITE_` দিয়ে নয়)

## সিকিউরিটি (ফেজ ৮)
- [ ] Supabase Auth: leaked password protection + ইমেল কনফার্মেশন চালু, ন্যূনতম পাসওয়ার্ড দৈর্ঘ্য
- [ ] Supabase Auth: CAPTCHA (Cloudflare Turnstile secret) চালু, Redirect URL তালিকা শুধু নিজের ডোমেইন
- [ ] অ্যাডমিন অ্যাকাউন্টে MFA, অ্যাডমিন রোল শুধু ডেটাবেজ থেকে
- [ ] Supabase Security Advisor রিপোর্ট পরিষ্কার
- [ ] ডোমেইন Cloudflare-এর পেছনে (DNS proxy, bot fight, WAF/রেট-লিমিট)
- [ ] Supabase ব্যাকআপ/PITR (প্রয়োজনে প্ল্যান আপগ্রেড) + একবার রিস্টোর টেস্ট
- [ ] Sentry ও আপটাইম মনিটর অ্যাকাউন্ট খুলে DSN বসান
- [ ] CSP: Report-Only থেকে Enforce করার সিদ্ধান্ত (রিপোর্ট দেখে)

## মাইগ্রেশন
- [ ] প্রতিটি নতুন মাইগ্রেশন আগে **স্টেজিং** Supabase প্রজেক্টে, তারপর প্রোডাকশনে
- [ ] প্রতিটির পর `supabase/audit/step0_db_audit.sql` চালিয়ে RLS দেখা

## ভিডিও/CDN (ফেজ ৩)
- [ ] Cloudflare R2 বাকেট, কাস্টম ডোমেইন `cdn.artraders.com.bd`
- [ ] `supabase secrets set R2_ACCOUNT_ID=… R2_ACCESS_KEY_ID=… R2_SECRET_ACCESS_KEY=… R2_BUCKET=…`
- [ ] R2 চালু ও যাচাইয়ের পর ভিডিও সীমা ১০০ MB করার সিদ্ধান্ত (তিন জায়গায় একসাথে)

## কুরিয়ার (ফেজ ৬)
- [ ] Pathao sandbox টেস্ট পাশ হলে live credentials Supabase Secrets-এ
- [ ] ওয়েবহুক URL ও সিক্রেট কুরিয়ার প্যানেলে বসান

## AdSense ও আইনি
- [ ] AdSense আবেদন (আগে পাবলিক কনটেন্ট, Privacy/Terms/Contact, বাস্তব ইউজার)
- [ ] AdSense প্যানেলে **Auto ads, Anchor, Vignette বন্ধ**
- [ ] EEA/UK-এর জন্য Google-সার্টিফাইড CMP
- [ ] `VITE_ADS_ENABLED=true` শুধু অনুমোদনের পর, Vercel env-এ
- [ ] ফিডে অ্যাড (৪.৩): ডেটা দেখে নিজে সিদ্ধান্ত। অটোপাইলট এটা বানায় না
- [ ] পলিসি পেজগুলো একজন আইনজীবীকে দিয়ে যাচাই (বাংলাদেশের ডেটা/ডিজিটাল আইন)
- [ ] রয়্যালটি-ফ্রি/লাইসেন্সড মিউজিক ট্র্যাক আপলোড (`music_tracks`)

## লাইভের আগে
- [ ] `artraders.com.bd` ডোমেইন Vercel-এ যুক্ত, `ads.txt` লাইভে খোলে
- [ ] মোবাইল 4G-তে রিলস লোড টেস্ট
- [ ] Draft PR রিভিউ ও মার্জ (`roadmap/reports/FINAL.md` দেখে)
