// ============================================================
// Eternal Karma — Droptimizer Backend (Google Apps Script)
// ============================================================
// SETUP:
// 1. Go to https://script.google.com → New Project
// 2. Paste this entire file
// 3. Click Deploy → New Deployment → Web App
//    - Execute as: Me
//    - Who has access: Anyone
// 4. Copy the Web App URL
// 5. Paste it in ek-droptimizer-submit.html AND ek-loot-advisor-v3.html
//    where it says BACKEND_URL = '...'
// ============================================================

const SHEET_NAME = 'Submissions';
const META_SHEET = 'Sessions';

// ── GET: Fetch submissions ──────────────────────────────────
// ?action=session           → all submissions for today's session
// ?action=session&date=YYYY-MM-DD → submissions for specific date
// ?action=all               → every submission ever
function doGet(e) {
  const action = (e.parameter.action || 'session').toLowerCase();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) return jsonResp({ ok: false, error: 'No submissions yet' });

  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return jsonResp({ ok: true, submissions: [], count: 0 });

  const headers = data[0];
  const rows = data.slice(1).map(r => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = r[i]);
    return obj;
  });

  if (action === 'all') {
    return jsonResp({ ok: true, submissions: rows, count: rows.length });
  }

  // Default: today's session (or specific date)
  const targetDate = e.parameter.date || todayStr();
  const filtered = rows.filter(r => String(r.date) === targetDate);

  // Build player map (latest submission per player for this date)
  const playerMap = {};
  filtered.forEach(r => {
    const name = String(r.player).toLowerCase();
    if (!playerMap[name] || new Date(r.timestamp) > new Date(playerMap[name].timestamp)) {
      playerMap[name] = r;
    }
  });

  const latest = Object.values(playerMap);
  return jsonResp({ ok: true, date: targetDate, submissions: latest, count: latest.length });
}

// ── POST: Save a submission ─────────────────────────────────
// Body JSON: { player, baseDps, upgrades: [{item,slot,ilvl,gain},...], reportUrl? }
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const player = String(body.player || '').trim();
    if (!player) return jsonResp({ ok: false, error: 'Missing player name' });

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      sheet.appendRow(['timestamp', 'date', 'player', 'baseDps', 'upgradeCount', 'topItem', 'topGain', 'ekDropCode', 'reportUrl', 'rawUpgrades']);
      sheet.getRange(1, 1, 1, 10).setFontWeight('bold');
    }

    const now = new Date();
    const date = todayStr();
    const baseDps = Number(body.baseDps) || 0;
    const upgrades = Array.isArray(body.upgrades) ? body.upgrades : [];
    const topUpgrade = upgrades.length > 0 ? upgrades[0] : { item: '—', gain: 0 };

    // Build EK-DROP code
    const pairs = upgrades.map(u => u.item + ':' + u.gain);
    const ekDropCode = 'EK-DROP|' + player + '|' + baseDps + '|' + pairs.join(',');

    sheet.appendRow([
      now.toISOString(),
      date,
      player,
      baseDps,
      upgrades.length,
      topUpgrade.item,
      topUpgrade.gain,
      ekDropCode,
      body.reportUrl || '',
      JSON.stringify(upgrades)
    ]);

    // Update session meta
    updateSessionMeta(ss, date, player);

    return jsonResp({
      ok: true,
      message: player + ' submission saved',
      date: date,
      upgradeCount: upgrades.length,
      ekDropCode: ekDropCode
    });
  } catch (err) {
    return jsonResp({ ok: false, error: err.message });
  }
}

// ── Session Meta Tracking ───────────────────────────────────
function updateSessionMeta(ss, date, player) {
  let meta = ss.getSheetByName(META_SHEET);
  if (!meta) {
    meta = ss.insertSheet(META_SHEET);
    meta.appendRow(['date', 'players', 'lastUpdate']);
    meta.getRange(1, 1, 1, 3).setFontWeight('bold');
  }

  const data = meta.getDataRange().getValues();
  let rowIdx = -1;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === date) { rowIdx = i + 1; break; }
  }

  if (rowIdx === -1) {
    meta.appendRow([date, player, new Date().toISOString()]);
  } else {
    const existing = String(meta.getRange(rowIdx, 2).getValue());
    const players = existing.split(',').map(s => s.trim().toLowerCase());
    if (!players.includes(player.toLowerCase())) {
      meta.getRange(rowIdx, 2).setValue(existing + ', ' + player);
    }
    meta.getRange(rowIdx, 3).setValue(new Date().toISOString());
  }
}

// ── Helpers ─────────────────────────────────────────────────
function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function jsonResp(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
