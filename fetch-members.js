import { readFileSync, writeFileSync, existsSync } from "node:fs";

const TOKEN = process.env.PATREON_TOKEN;
const API = "https://www.patreon.com/api/oauth2/v2";

if (!TOKEN) {
  console.error("Saknar PATREON_TOKEN");
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  "User-Agent": "synkat-podcast-website"
};

async function api(url) {
  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`Patreon API-fel ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

// 1. Hitta kampanjens id
const campaigns = await api(`${API}/campaigns`);
const campaignId = campaigns.data?.[0]?.id;
if (!campaignId) throw new Error("Hittade ingen kampanj");

// 2. Hämta alla medlemmar (med paginering)
const fetched = [];
let cursor = "";

do {
  const url = new URL(`${API}/campaigns/${campaignId}/members`);
  url.searchParams.set("fields[member]", "full_name,patron_status");
  url.searchParams.set("page[count]", "200");
  if (cursor) url.searchParams.set("page[cursor]", cursor);

  const json = await api(url);

  for (const m of json.data || []) {
    fetched.push({
      id: m.id,
      name: (m.attributes?.full_name || "").trim(),
      active: m.attributes?.patron_status === "active_patron"
    });
  }

  cursor = json.meta?.pagination?.cursors?.next || "";
} while (cursor);

// 3. Slå ihop med befintlig members.json
const existing = existsSync("members.json")
  ? JSON.parse(readFileSync("members.json", "utf8")).members || []
  : [];

const byId = new Map(existing.filter(m => m.id).map(m => [m.id, m]));
let added = 0;

for (const f of fetched) {
  if (!f.name) continue;

  const current = byId.get(f.id);

  if (current) {
    current.active = f.active; // behåll namn och visible
  } else if (f.active) {
    // Nya medlemmar är dolda tills de gett sitt ok
    existing.push({ id: f.id, name: f.name, visible: false, active: true });
    added++;
  }
}

// Befintliga rader utan id (manuellt tillagda) lämnas orörda
writeFileSync("members.json", JSON.stringify({ members: existing }, null, 2));
console.log(`Klart. ${added} nya medlemmar tillagda (dolda tills du sätter visible: true).`);