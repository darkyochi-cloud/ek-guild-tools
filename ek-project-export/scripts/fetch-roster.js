// Fetch updated roster from Blizzard API for ranks 0-5
// Run: node scripts/fetch-roster.js
const fs = require('fs');
const path = require('path');
const https = require('https');

const CLIENT_ID = 'a9bac31a3ba249c9a0d0850c6fa34ed8';
const CLIENT_SECRET = 'tGYtfPGFQ9BV56kYa1BrqK7MOowi28Vh';
const REGION = 'us';
const REALM = 'ragnaros';
const GUILD = 'eternal-karma';
const LOCALE = 'en_US';
const INCLUDED_RANKS = [0, 1, 2, 3, 4, 5];

const RANK_NAMES = {
  0: 'CEO', 1: 'Vice Presidente', 2: 'Director', 3: 'Raider',
  4: 'Becario', 5: 'Alts'
};
const MAIN_RANKS = ['CEO', 'Vice Presidente', 'Director', 'Raider', 'Becario'];

// Disable SSL revocation check (matches curl --ssl-no-revoke)
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

async function fetchJson(url, headers = {}) {
  const resp = await fetch(url, { headers, agent: httpsAgent });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${url}`);
  return resp.json();
}

async function getToken() {
  const auth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  const resp = await fetch('https://us.battle.net/oauth/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials',
    agent: httpsAgent
  });
  const data = await resp.json();
  return data.access_token;
}

async function fetchProfile(token, name, realmSlug) {
  try {
    const url = `https://${REGION}.api.blizzard.com/profile/wow/character/${realmSlug}/${encodeURIComponent(name.toLowerCase())}?namespace=profile-${REGION}&locale=${LOCALE}`;
    return await fetchJson(url, { Authorization: `Bearer ${token}` });
  } catch (e) {
    return null;
  }
}

const ARMOR_BY_CLASS = {
  'Death Knight': 'Placa', 'Paladin': 'Placa', 'Warrior': 'Placa',
  'Hunter': 'Malla', 'Shaman': 'Malla', 'Evoker': 'Malla',
  'Demon Hunter': 'Cuero', 'Druid': 'Cuero', 'Monk': 'Cuero', 'Rogue': 'Cuero',
  'Mage': 'Tela', 'Priest': 'Tela', 'Warlock': 'Tela'
};

const TANK_SPECS = ['Blood','Vengeance','Guardian','Brewmaster','Protection'];
const HEALER_SPECS = ['Restoration','Preservation','Mistweaver','Holy','Discipline'];

function inferRole(spec) {
  if (TANK_SPECS.includes(spec)) return 'Tank';
  if (HEALER_SPECS.includes(spec)) return 'Healer';
  return 'DPS';
}

async function main() {
  console.log('[1/4] Loading cached guild roster...');
  const guildData = JSON.parse(fs.readFileSync('C:/Users/PC/AppData/Local/Temp/ek_guild_roster.json','utf8'));
  const members = (guildData.members || []).filter(m => INCLUDED_RANKS.includes(m.rank));
  console.log(`     ${members.length} members in ranks 0-5`);

  console.log('[2/4] Getting fresh OAuth token...');
  const token = await getToken();
  console.log('     Token acquired');

  console.log('[3/4] Fetching character profiles in batches of 8...');
  const roster = [];
  const batchSize = 8;
  for (let i = 0; i < members.length; i += batchSize) {
    const slice = members.slice(i, i + batchSize);
    const profiles = await Promise.all(slice.map(m =>
      fetchProfile(token, m.character.name, m.character.realm.slug)
    ));
    slice.forEach((m, j) => {
      const profile = profiles[j];
      const charName = m.character.name;
      const rankName = RANK_NAMES[m.rank] || ('Rango ' + m.rank);
      const className = profile?.character_class?.name || 'Unknown';
      const spec = profile?.active_spec?.name || 'Unknown';
      const itemLevel = profile?.equipped_item_level || profile?.average_item_level || 0;
      const role = inferRole(spec);
      const armorType = ARMOR_BY_CLASS[className] || 'Tela';

      roster.push({
        id: m.character.id,
        name: charName,
        className,
        spec,
        role,
        roleOverride: null,
        specOverride: null,
        armorType,
        itemLevel,
        rioScore: 0,
        realm: m.character.realm.slug || REALM,
        rank: rankName,
        rankNum: m.rank,
        owner: charName,
        isMain: MAIN_RANKS.includes(rankName),
        mythicRating: 0,
        missingEnchants: 0,
        missingGems: 0,
        wclHeroicAvg: null,
        wclMythicAvg: null,
        wclHeroicBossKills: 0
      });
    });
    console.log(`     ${Math.min(i + batchSize, members.length)}/${members.length}`);
  }

  console.log('[4/4] Saving updated roster...');
  const outPath = path.join(__dirname, '..', 'data', 'ek-roster-export.json');
  fs.writeFileSync(outPath, JSON.stringify(roster));
  console.log(`     Saved ${roster.length} characters to ${outPath}`);

  // Print summary
  console.log('\n=== SUMMARY ===');
  const byRank = {};
  roster.forEach(p => { byRank[p.rank] = (byRank[p.rank]||0)+1; });
  Object.entries(byRank).forEach(([k,v]) => console.log(`  ${k}: ${v}`));
}

main().catch(e => { console.error(e); process.exit(1); });
