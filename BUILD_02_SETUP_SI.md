# DREAMORA BUILD 02 — Sinhala Setup Guide

මේ Build එකෙන් DREAMORA එකට online account සහ cloud sync එක එකතු කරලා තියෙනවා. දැනට Guest mode එකත් වැඩ කරනවා.

## 1. Supabase project එක සූදානම් කරගන්න

1. https://supabase.com/ වෙත ගිහින් sign in වෙන්න.
2. DREAMORA සඳහා project එකක් create කරන්න.
3. **වැදගත්:** NEXUS සඳහා දැනටමත් භාවිතා කරන Supabase project එකක් තිබේ නම්, database tables එකිනෙකට ගැටෙන්න පුළුවන්. ඒ නිසා DREAMORA සඳහා වෙනම Supabase project එකක් භාවිතා කරන්න.
4. Project එක create වෙනකම් ඉන්න. Database password එක ආරක්ෂිතව තබාගන්න; ඒක DREAMORA app එකට දාන්න ඕන නැහැ.

## 2. Database SQL එක Run කරන්න

1. Supabase Dashboard එකේ වම් පැත්තෙන් **SQL Editor** තෝරන්න.
2. **New query** තෝරන්න.
3. මේ project folder එකේ `supabase/schema.sql` file එක open කරන්න.
4. ඒ file එකේ සියලුම SQL lines copy කරලා Supabase SQL Editor එකට paste කරන්න.
5. **Run** ඔබන්න.
6. Error එකක් ආවොත් screenshot එකක් එවන්න. Error එක බලලා ඊළඟ පියවර කියන්නම්.

## 3. Project URL සහ public key එක ගන්න

Supabase Dashboard → **Project Settings** → **API** (නැත්නම් **API Keys**) වෙත යන්න.

- **Project URL** එක copy කරන්න. සාමාන්‍යයෙන් `https://your-project-ref.supabase.co` වගේ.
- **anon / publishable public key** එක copy කරන්න.
- `service_role` / secret key එක කිසිම විටක DREAMORA එකට paste කරන්න එපා. ඒක private server-side key එකක්.

## 4. DREAMORA එකට connect කරන්න

1. DREAMORA app එක open කරන්න.
2. ඉහළ තියෙන **Guest mode** button එක click කරන්න.
3. Project URL එක සහ public anon / publishable key එක paste කරන්න.
4. **Save project connection** click කරන්න.
5. **Create account** tab එක තෝරලා display name, email සහ password (අවම අකුරු 8) ඇතුළත් කරන්න.
6. Email verification ඉල්ලුවොත් email එක verify කරලා නැවත Sign in වෙන්න.

## 5. Cloud sync පරීක්ෂා කිරීම

Sign in වුණාට පස්සේ ඉහළ status එක **Synced** ලෙස පෙන්විය යුතුයි. Focus session එකක් හෝ topic එකක් වෙනස් කරලා ටික වෙලාවක් ඉන්න; එවිට වෙනස්කම් cloud එකට save වෙනවා.

වෙනත් device එකකින් ඒ account එකට sign in වුණාම එම account එකේ saved progress load වෙයි. වෙනත් account එකක දත්ත වෙනම තබාගන්න RLS policies භාවිතා කරනවා.

## ආරක්ෂාව සහ දැනට ඇති සීමාව

- Project URL සහ public anon/publishable key browser එකේ තබාගැනීම සාමාන්‍ය දෙයක්; private `service_role` key එක දාන්න එපා.
- Supabase Row Level Security මඟින් එක් account එකකට තමන්ගේ cloud save row එක පමණක් access කරන්න පුළුවන්.
- Build 02 එකේ XP සහ progress snapshot එක app එකෙන්ම update වෙන නිසා තවම tamper-proof නැහැ. Competitive leaderboard හෝ ත්‍යාග සඳහා XP භාවිතා කරන්න එපා.
- Server-verified focus sessions/XP, password reset, account deletion සහ production security review ඊළඟ build එකේ වැඩ.
