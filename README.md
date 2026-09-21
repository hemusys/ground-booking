# Ground Manager 🏏
> The high-velocity cricket ground and net booking operations system for Indian turf owners.

---

## ⚡ Operational Highlights

* **< 10-Second Quick Booking**: Global keyboard hotkey `N` or tap any slot on the timeline to book.
* **Auto-Computed Flexible Durations**: Full support for custom ground & net durations (30m, 60m, 90m, 2h, 4h).
* **Double-Booking Hard Lock**: Client and PostgreSQL ACID-level overlap prevention.
* **Advance & Pending Ledger**: Color-coded Green (Paid), Amber (Advance Paid, Balance Due), and Red (Unpaid).
* **1-Tap Direct WhatsApp Confirmation**: Generates formatted booking summaries via `wa.me` (zero API cost).
* **High-Contrast Dark Mode**: Designed for field usability in direct sun and night floodlights.
* **Mobile 390px Responsive**: Bottom navigation with instant Due Collections and Customer Directory.

---

## 🚀 Quick Start

### 1. Install & Run Locally
```bash
# Install dependencies
npm install

# Start Vite dev server
npm run dev
```

The app will run at `http://localhost:3000` with pre-seeded demo data for instant testing.

---

## 🗄️ Database Setup (Supabase / PostgreSQL)

1. Create a project in [Supabase](https://supabase.com).
2. Go to **SQL Editor** in Supabase and run the migration script located at:
   `supabase/migrations/20260920000000_init_ground_manager.sql`
3. Copy your Project URL and Anon Key into `.env`:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```
4. Deploy to Vercel with one click.
