import { writeFileSync } from "node:fs";

const API_KEY = process.env.YOUTUBE_API_KEY;
const CHANNEL_ID = "UCOpKGabPGVdZtEaA8NkIWYA";

// Kanalens "uploads"-spellista: UC... byts mot UU...
const UPLOADS_PLAYLIST = "UU" + CHANNEL_ID.slice(2);

// Valfritt filter: lämna tom för att ta med ALLA uppladdningar.
// Exempel: /avsnitt/i  => bara videor med "avsnitt" i titeln.
const TITLE_FILTER = null;

if (!API_KEY) {
  console.error("Saknar YOUTUBE_API_KEY");
  process.exit(1);
}

async function fetchAll() {
  const videos = [];
  let pageToken = "";

  do {
    const url = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
    url.searchParams.set("part", "snippet");
    url.searchParams.set("playlistId", UPLOADS_PLAYLIST);
    url.searchParams.set("maxResults", "50");
    url.searchParams.set("key", API_KEY);
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`YouTube API-fel ${res.status}: ${await res.text()}`);
    }

    const data = await res.json();

    for (const item of data.items || []) {
      const s = item.snippet;
      const id = s.resourceId?.videoId;

      // Hoppa över borttagna/privata videor
      if (!id || s.title === "Private video" || s.title === "Deleted video") {
        continue;
      }

      if (TITLE_FILTER && !TITLE_FILTER.test(s.title)) continue;

      const t = s.thumbnails || {};
      const thumb =
        (t.maxres || t.standard || t.high || t.medium || t.default || {}).url || "";

      videos.push({
        id,
        title: s.title,
        description: s.description || "",
        date: s.publishedAt,
        image: thumb,
        youtube: `https://www.youtube.com/watch?v=${id}`
      });
    }

    pageToken = data.nextPageToken || "";
  } while (pageToken);

  // Nyast först
  videos.sort((a, b) => new Date(b.date) - new Date(a.date));
  return videos;
}

const episodes = await fetchAll();
writeFileSync("episodes.json", JSON.stringify(episodes, null, 2));
console.log(`Sparade ${episodes.length} avsnitt i episodes.json`);