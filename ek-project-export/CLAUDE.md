# Eternal Karma — Guild Operating System

## Project Overview
**Eternal Karma** is a World of Warcraft guild on **Ragnaros-US** server. This project is a suite of tools to help the Guild Master / Raid Leader (Jose) make better data-driven decisions about loot distribution, raid composition, attendance, performance tracking, and roster management.

The goal is NOT just "an app" — it's a **guild operating system** with real-time data, algorithms, and dashboards that give the raid leader a decision-making advantage.

## Current State (v3 — March 2026)

### Files

#### `src/ek-loot-advisor-v3.html` (~2036 lines)
**Main application** — Single-file standalone HTML app with embedded CSS + JS. No build step needed; opens directly in a browser.

**Tabs:**
1. **Roster** — Import roster from RaidForge JSON, select active raiders, filter by role/class/armor type
2. **Loot** — Add boss drops, each item gets scored against all selected raiders using the 3-factor algorithm
3. **Results** — Ranked candidate list per item with visual score breakdown
4. **BiS Guide** — Class/spec Best-in-Slot reference with trinket tier lists (data sourced from Archon/Wowhead)

**Key Features:**
- **3-Factor Scoring Algorithm**: Droptimizer DPS Gain (normalized 0-1) + WCL Performance (0-1) + Attendance (0-1), with adjustable weight sliders
- **Droptimizer Session Tracker**: Visual grid showing who submitted their droptimizer data and who's missing, with timestamps and item counts
- **Import System**: Accepts EK-DROP codes (compact format) and Raidbots URLs
- **Backend Sync**: "☁️ Sync Server" button fetches today's submissions from Google Apps Script backend
- **Tier Set Tracker**: Track which raiders have which tier pieces (Head, Shoulders, Chest, Hands, Legs)
- **Loot History**: Tracks all assigned loot across sessions
- **Presets**: Balanced (50/30/20), Sim First (70/20/10), Performance (30/50/20)

**Data Storage:** localStorage with keys:
- `ek_roster` — full roster array
- `ek_selected` — selected player IDs
- `ek_algo_weights_v2` — `{ drop: 50, wcl: 30, att: 20 }`
- `ek_droptimizer` — `{ "PlayerName": { "_baseDps": 39746, "_submittedAt": "ISO", "item_name": { item, gain, source } } }`
- `ek_loot_history` — array of assigned items
- `ek_tier_data` — tier set tracking per player

#### `src/ek-droptimizer-submit.html` (~305 lines)
**Raider-facing submission page** — Each raider gets a personalized link like `?player=Garompinax`.

**Flow:**
1. Raider opens their personalized link
2. Runs Droptimizer on Raidbots (Season 1 Raids, Mythic, all 3 raids)
3. Pastes the Raidbots report URL
4. Page fetches `raidbots.com/reports/{ID}/data.json`, extracts upgrades
5. Auto-submits to Google Apps Script backend (if configured)
6. Also generates EK-DROP code as Discord fallback

**EK-DROP Code Format:**
```
EK-DROP|PlayerName|BaseDPS|Item1:Gain1,Item2:Gain2,...
```
Example: `EK-DROP|Garompinax|39746|Gaze of the Alnseer:2473,Writhing Ringworm:1836,...`

**CORS Note:** Fetching `data.json` from Raidbots may fail due to CORS when opened from local file. Page has manual fallback: raider opens data.json URL directly, copies JSON, pastes it.

#### `src/ek-droptimizer-backend.gs` (~149 lines)
**Google Apps Script backend** — Acts as REST API backed by Google Sheets.

**Endpoints:**
- `POST /` — Save a submission `{ player, baseDps, upgrades: [{item,slot,ilvl,gain}], reportUrl }`
- `GET /?action=session` — Today's submissions (latest per player)
- `GET /?action=session&date=YYYY-MM-DD` — Specific date
- `GET /?action=all` — All historical submissions

**Sheets:**
- `Submissions` — timestamp, date, player, baseDps, upgradeCount, topItem, topGain, ekDropCode, reportUrl, rawUpgrades
- `Sessions` — date, players (comma-separated), lastUpdate

**Setup:** Create Google Apps Script → paste code → Deploy as Web App (Execute as: Me, Access: Anyone) → Copy URL → Paste in both HTML files as `BACKEND_URL`

#### `data/rcloot-history.csv` (~38KB, 102 rows)
RCLootCouncil addon export from WoW. Contains full loot history across 3 raid dates (Mar 18, 25, 26 2026). CSV columns: player, date, time, id, item, itemID, itemString, response, votes, class, instance, boss, difficultyID, mapID, groupSize, gear1, gear2, responseID, isAwardReason, subType, equipLoc, note, owner.

**Key data points:**
- 76 council loot items (34 BIS, 33 Upgrade, 9 Off spec — only BIS and Upgrade are shown/counted in the app)
- 18 Personal Loot entries (auto-excluded)
- 30 unique players received council loot
- Raids: The Voidspire (Normal + Heroic), The Dreamrift (Normal + Heroic)
- Response types: BIS (best in slot), Upgrade, Off spec, Pass, Disenchant, Personal Loot, Banking

**Import in Loot Advisor:** Tab 5 → "Importar RCLootCouncil" button. Parser filters to BIS+Upgrade only, cleans player names (removes realm suffix), cleans item names (removes brackets), deduplicates by RCLC ID.

#### `data/ek-roster-export.json` (~22KB, 66 characters)
Roster export from RaidForge API. Compact JSON array with fields:
- id, name (nm), className (cN), spec (sN), role, roleOverride, specOverride, armorType, itemLevel, and more

#### `data/garompinax-droptimizer.json` (~6KB)
Example Droptimizer output for Garompinax (Brewmaster Monk). 53 upgrades, baseDps: 39746. Top upgrade: Gaze of the Alnseer trinket +2,473 DPS (6.22%).

---

## Architecture

### Current: Monolith Single-File HTML
Everything is in one HTML file with inline CSS and JS. This was intentional for MVP — zero dependencies, zero build step, works offline, easy to share.

### Target: Modular Web App
The next evolution should break this into a proper project:

```
ek-guild-tools/
├── package.json
├── src/
│   ├── index.html
│   ├── styles/
│   │   ├── base.css
│   │   ├── roster.css
│   │   ├── loot.css
│   │   └── droptimizer.css
│   ├── js/
│   │   ├── app.js              # Main app, tab switching, toast
│   │   ├── roster.js           # Roster import, player cards, selection
│   │   ├── loot.js             # Boss/item input, scoring algorithm
│   │   ├── results.js          # Ranked candidates, result cards
│   │   ├── droptimizer.js      # Session tracker, import, sync
│   │   ├── bis.js              # BiS guide, trinket tiers
│   │   ├── tier-tracker.js     # Tier set tracking
│   │   ├── algorithm.js        # 3-factor scoring engine
│   │   ├── backend.js          # API calls to Apps Script
│   │   └── constants.js        # Class colors, armor types, slot data
│   └── components/             # Future: React/Svelte components
├── backend/
│   └── ek-droptimizer-backend.gs
├── submit/
│   └── ek-droptimizer-submit.html
└── data/
    ├── ek-roster-export.json
    └── garompinax-droptimizer.json
```

### Recommended Stack for Next Phase
- **Frontend**: Vanilla JS → migrate to React/Next.js or Svelte when complexity demands it
- **Backend**: Google Apps Script (current) → Supabase or Vercel + PostgreSQL for real-time
- **Hosting**: GitHub Pages or Vercel (free tier)
- **Auth**: Discord OAuth (raiders already use Discord)
- **Data Sources**: Warcraft Logs API, Raider.IO API, Raidbots reports, RaidForge

---

## Scoring Algorithm (3-Factor)

```
Score = (dropScore × w_drop + wclScore × w_wcl + attScore × w_att) / normalizedWeightSum
```

Where:
- `dropScore` = player's DPS gain for this specific item / max DPS gain across all players (0-1)
- `wclScore` = WCL performance percentile / 100 (0-1)
- `attScore` = attendance percentage / 100 (0-1)
- Weights are user-adjustable via sliders, dynamically normalized

**Key behavior:** If a player has 0 ilvl gap (already has equal or better item), score = 0 regardless of weights.

---

## Data Flow

### Droptimizer Submission Flow
```
Raider opens ?player=Name link
  → Runs Droptimizer on Raidbots
  → Pastes report URL
  → Submit page fetches data.json (or manual paste fallback)
  → Extracts upgrades (item, slot, ilvl, gain)
  → POSTs to Google Apps Script backend
  → Also generates EK-DROP code for Discord backup

Raid Leader opens Loot Advisor
  → Clicks "☁️ Sync Server"
  → Fetches today's session from backend
  → Imports all raider submissions
  → Session grid shows submitted ✅ / missing ❌
  → Algorithm uses DPS gains for loot scoring
```

### Manual Flow (Discord fallback)
```
Raider generates EK-DROP code → pastes in Discord #droptimizer
Raid Leader copies codes → pastes in Loot Advisor import box → clicks Import
```

---

## Known Issues & Tech Debt

1. **CORS on Raidbots**: Fetching data.json from a different origin may fail. Manual paste fallback exists but UX is rough.
2. **Single-file monolith**: 2000+ lines in one HTML file makes maintenance hard. Needs modularization.
3. **localStorage only**: Data doesn't persist across browsers/devices. Backend partially solves this but only for droptimizer data.
4. **No authentication**: Anyone with the submit URL can submit for any player. Needs Discord OAuth or token system.
5. **No real-time updates**: Raid Leader must manually click "Sync Server". Should be auto-polling or WebSocket.
6. **WCL and Attendance data**: Currently manually entered or assumed (defaults: WCL=0, Attendance=90%). Needs Warcraft Logs API integration.
7. **BiS data is hardcoded**: Trinket tier lists and BiS tables are static. Should pull from Archon API or scrape.

---

## Roadmap

### Phase 1 — MVP Cleanup (Current)
- [x] 3-factor algorithm (Droptimizer + WCL + Attendance)
- [x] Droptimizer session tracker
- [x] Personalized submit pages
- [x] Google Apps Script backend
- [x] Backend sync in Loot Advisor
- [ ] Modularize codebase (break out of single file)
- [ ] Deploy to GitHub Pages or Vercel

### Phase 2 — Data Integration
- [ ] Warcraft Logs API integration (auto-pull performance data)
- [ ] Raider.IO API integration (M+ scores, raid progression)
- [ ] Attendance tracking from raid logs
- [ ] Auto-poll backend every 30s during raid

### Phase 3 — Advanced Features
- [ ] Discord OAuth for raider auth
- [ ] Raid comp optimizer (role/class/buff coverage)
- [ ] Armor type funnel planner (heroic splits)
- [ ] Main/Alt management with gear routing
- [ ] Officer notes and trial evaluation system
- [ ] Historical performance trends
- [ ] Weekly raid summaries (auto-generated)

### Phase 4 — Full Platform
- [ ] Supabase backend (real-time, persistent)
- [ ] Dashboard for officers
- [ ] Recruitment pipeline tracker
- [ ] Discord bot integration (commands, notifications)
- [ ] Mobile-friendly responsive design

---

## WoW-Specific Context

### Armor Types & Funnel
- **Plate**: Death Knight, Paladin, Warrior
- **Mail**: Evoker, Hunter, Shaman
- **Leather**: Demon Hunter, Druid, Monk, Rogue
- **Cloth**: Mage, Priest, Warlock

Funnel = giving loot from alts to mains of same armor type during heroic splits.

### Tier Sets
5 slots: Head, Shoulders, Chest, Hands, Legs. 2-piece and 4-piece set bonuses are critical for performance.

### Droptimizer
Raidbots simulation that compares every possible item drop against your current gear and tells you the DPS gain. This is the most objective measure of "how much does this raider benefit from this specific item."

### Key Metrics for Raiders
- **WCL Performance**: Warcraft Logs parse percentile (0-100). Higher = better DPS/HPS relative to spec.
- **Attendance**: % of raids attended. Reliability indicator.
- **Item Level**: Average gear level. Higher ilvl gap = more potential benefit.
- **Droptimizer Gain**: Simulated DPS improvement for specific items.

---

## Development Notes

### Class Colors (WoW standard)
```javascript
const CLASS_COLORS = {
  'Death Knight': '#C41E3A', 'Demon Hunter': '#A330C9', 'Druid': '#FF7C0A',
  'Evoker': '#33937F', 'Hunter': '#AAD372', 'Mage': '#3FC7EB',
  'Monk': '#00FF98', 'Paladin': '#F48CBA', 'Priest': '#FFFFFF',
  'Rogue': '#FFF468', 'Shaman': '#0070DD', 'Warlock': '#8788EE',
  'Warrior': '#C69B6D'
};
```

### Raidbots Data Access
Report data accessible at: `https://www.raidbots.com/reports/{REPORT_ID}/data.json`
- No API key needed
- Contains: `sim.players[0].collected_data.dps.mean` (base DPS)
- Contains: `sim.profilesets.results[]` (all simmed items with mean DPS)
- Contains: `simbot.meta.rawFormData.droptimizerItems[]` (item names, slots, ilvls)

### RaidForge Roster
Roster from RaidForge API. Each player object:
```json
{
  "nm": "Garompinax",
  "cN": "Monk",
  "sN": "Brewmaster",
  "role": "TANK",
  "at": "Leather",
  "il": 639,
  "uid": "unique-id"
}
```

---

## Coding Conventions

- **Language**: Spanish for UI labels and user-facing text, English for code/variables
- **Style**: Dark theme (#0f0f23 base, #a335ee purple accent, #ffd700 gold, #2ecc40 green)
- **Font**: Segoe UI / system sans-serif
- **Metadata keys**: Prefixed with `_` (e.g., `_baseDps`, `_submittedAt`) to distinguish from item data
- **Toast notifications**: `toast(message, isSuccess)` — green for success, red for error
