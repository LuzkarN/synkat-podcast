import { readFileSync, writeFileSync, existsSync } from "node:fs";

const API_KEY = process.env.YOUTUBE_API_KEY;
const SPOTIFY_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

const CHANNEL_ID = "UCOpKGabPGVdZtEaA8NkIWYA";
const SPOTIFY_SHOW_ID = "7FA8CJrxPsqUjiNxIUiIrA";

// "UULF" = kanalens vanliga videor, utan Shorts (och utan livesändningar)
const UPLOADS_PLAYLIST = "UULF" + CHANNEL_ID.slice(2);

// Valfritt filter, t.ex. /avsnitt/i. null = ta med allt.
const TITLE_FILTER = null;

if (!API_KEY) {
  console.error("Saknar YOUTUBE_API_KEY");
  process.exit(1);
}

// ---------------------------
// YOUTUBE
// ---------------------------

async function fetchYouTube() {
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

  videos.sort((a, b) => new Date(b.date) - new Date(a.date));
  return videos;
}

// ---------------------------
// SPOTIFY
// ---------------------------

async function spotifyToken() {
  const basic = Buffer.from(`${SPOTIFY_ID}:${SPOTIFY_SECRET}`).toString("base64");

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials"
  });

  if (!res.ok) {
    throw new Error(`Spotify token-fel ${res.status}: ${await res.text()}`);
  }
  return (await res.json()).access_token;
}

async function fetchSpotifyEpisodes() {
  const token = await spotifyToken();
  const headers = { Authorization: `Bearer ${token}` };
  const episodes = [];

  for (const limit of [50, 10]) {
    episodes.length = 0;
    let url =
      `https://api.spotify.com/v1/shows/${SPOTIFY_SHOW_ID}/episodes` +
      `?market=SE&limit=${limit}`;
    let badRequest = false;

    while (url) {
      const res = await fetch(url, { headers });

      if (res.status === 400 && limit === 50) {
        badRequest = true; // prova med lägre limit
        break;
      }
      if (!res.ok) {
        throw new Error(`Spotify API-fel ${res.status}: ${await res.text()}`);
      }

      const data = await res.json();
      for (const e of data.items || []) {
        if (!e) continue;
        episodes.push({
          name: e.name,
          date: e.release_date,
          url: e.external_urls?.spotify
        });
      }
      url = data.next;
    }

    if (!badRequest) break;
  }

  return episodes;
}

// ---------------------------
// PARA IHOP YOUTUBE OCH SPOTIFY
// ---------------------------

const norm = (t = "") => t.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

function dayDiff(a, b) {
  return Math.abs(new Date(a) - new Date(b)) / 86400000;
}

function findSpotify(video, spotifyEpisodes) {
  const vt = norm(video.title);

  // 1. Samma titel
  let match = spotifyEpisodes.find(e => norm(e.name) === vt);
  if (match) return match.url;

  // 2. Den ena titeln innehåller den andra
  match = spotifyEpisodes.find(e => {
    const st = norm(e.name);
    return st.length > 5 && vt.length > 5 && (st.includes(vt) || vt.includes(st));
  });
  if (match) return match.url;

  // 3. Samma publiceringsdatum (±1 dag), bara om det finns exakt ett
  const sameDay = spotifyEpisodes.filter(
    e => e.date && dayDiff(e.date, video.date.slice(0, 10)) <= 1
  );
  if (sameDay.length === 1) return sameDay[0].url;

  return null;
}

// ---------------------------
// KÖR
// ---------------------------

const videos = await fetchYouTube();

// Tidigare sparade Spotify-länkar behålls om Spotify inte svarar
const previous = existsSync("episodes.json")
  ? JSON.parse(readFileSync("episodes.json", "utf8"))
  : [];
const previousSpotify = new Map(
  previous.filter(e => e.spotify).map(e => [e.id, e.spotify])
);

let spotifyEpisodes = [];
let spotifyOk = false;

if (SPOTIFY_ID && SPOTIFY_SECRET) {
  try {
    spotifyEpisodes = await fetchSpotifyEpisodes();
    spotifyOk = true;
    console.log(`Hämtade ${spotifyEpisodes.length} avsnitt från Spotify`);
  } catch (error) {
    console.error("Spotify misslyckades, behåller tidigare länkar:", error.message);
  }
} else {
  console.log("Ingen Spotify-nyckel angiven, hoppar över Spotify.");
}

for (const video of videos) {
  const found = spotifyOk ? findSpotify(video, spotifyEpisodes) : null;
  const spotify = found || previousSpotify.get(video.id) || null;
  if (spotify) video.spotify = spotify;
}

writeFileSync("episodes.json", JSON.stringify(videos, null, 2));

const withSpotify = videos.filter(v => v.spotify).length;
console.log(`Sparade ${videos.length} avsnitt (${withSpotify} med Spotify-länk)`);