const PATREON_URL =
  "https://www.patreon.com/cw/SynkatPodcast?l=sv-SE";

const SPOTIFY_URL =
  "https://open.spotify.com/show/7FA8CJrxPsqUjiNxIUiIrA";

const YOUTUBE_URL =
  "https://www.youtube.com/@SynkatPodcast";

let allEpisodes = [];

// ---------------------------
// NAVIGATION
// ---------------------------

const pages = document.querySelectorAll(".page");
const navLinks = document.querySelectorAll(".nav-link");
const navigation = document.getElementById("navigation");
const menuToggle = document.getElementById("menuToggle");

function showPage() {
  const pageId = location.hash.replace("#", "") || "start";

  pages.forEach(page => {
    page.classList.toggle("active-page", page.id === pageId);
  });

  navLinks.forEach(link => {
    link.classList.toggle(
      "active",
      link.getAttribute("href") === "#" + pageId
    );
  });

  navigation.classList.remove("open");

  window.scrollTo({ top: 0, behavior: "smooth" });
}

window.addEventListener("hashchange", showPage);

menuToggle.addEventListener("click", () => {
  navigation.classList.toggle("open");
});

showPage();

document.getElementById("year").textContent =
  new Date().getFullYear();


// ---------------------------
// FORMATERING
// ---------------------------

function cleanDescription(description = "") {
  const temp = document.createElement("div");
  temp.innerHTML = description;

  return (temp.textContent || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 220);
}

function formatDate(date) {
  if (!date) return "";

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) return "";

  return parsed.toLocaleDateString("sv-SE", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}


// ---------------------------
// HÄMTA AVSNITT (från episodes.json)
// ---------------------------

async function loadEpisodes() {
  const container = document.getElementById("episodes");
  const latestContainer = document.getElementById("latestEpisode");

  try {
    const response = await fetch("episodes.json");

    if (!response.ok) {
      throw new Error("Kunde inte hämta episodes.json");
    }

    const items = await response.json();

    allEpisodes = items.map(item => ({
      title: item.title || "Synkat Podcast",
      description: cleanDescription(item.description),
      date: item.date || "",
      image:
        item.image ||
        "https://placehold.co/600x400/ed4d77/ffffff?text=Synkat+Podcast",
      youtube: item.youtube || null,
      spotify: item.spotify || null // kopplas ihop senare
    }));

    renderEpisodes(allEpisodes);
    renderLatestEpisode(allEpisodes[0]);

  } catch (error) {
    console.error(error);

    latestContainer.innerHTML =
      "<p>Avsnitten kunde inte hämtas just nu. Besök gärna vår YouTube!</p>";

    container.innerHTML =
      "<p>Det gick inte att ladda avsnitten just nu.</p>";

    document.getElementById("episodeError").textContent =
      "Försök igen senare.";
  }
}


// ---------------------------
// VISA ETT AVSNITT
// ---------------------------

function episodeHTML(episode) {
  const title = escapeHTML(episode.title);
  const description = escapeHTML(episode.description);
  const image = escapeHTML(episode.image);
  const date = escapeHTML(formatDate(episode.date));

  const youtubeLink = episode.youtube || YOUTUBE_URL;
  const youtubeText = episode.youtube ? "Se på YouTube ↗" : "YouTube-kanalen ↗";

  return `
    <article class="episode-card">
      <img src="${image}" alt="${title}" loading="lazy">

      <div class="episode-info">
        <span class="episode-date">${date}</span>

        <h3>${title}</h3>

        <p>${description}</p>

        <div class="episode-actions">
          <a href="${escapeHTML(youtubeLink)}" target="_blank" rel="noopener">
            ${youtubeText}
          </a>

          ${episode.spotify
      ? `<a href="${escapeHTML(episode.spotify)}" target="_blank" rel="noopener">Spotify ↗</a>`
      : ""}
        </div>
      </div>
    </article>
  `;
}


// ---------------------------
// VISA ALLA AVSNITT
// ---------------------------

function renderEpisodes(episodes) {
  const container = document.getElementById("episodes");

  container.innerHTML = episodes.length
    ? episodes.map(episodeHTML).join("")
    : "<p>Inga avsnitt hittades.</p>";

  document.getElementById("episodeCount").textContent =
    episodes.length + " avsnitt";
}


// ---------------------------
// VISA SENASTE AVSNITTET
// ---------------------------

function renderLatestEpisode(episode) {
  const container = document.getElementById("latestEpisode");

  if (!episode) {
    container.innerHTML = "<p>Inga avsnitt kunde hämtas.</p>";
    return;
  }

  container.innerHTML = episodeHTML(episode);
}


// ---------------------------
// SÖK AVSNITT
// ---------------------------

document
  .getElementById("episodeSearch")
  .addEventListener("input", event => {
    const search = event.target.value.toLowerCase();

    const filtered = allEpisodes.filter(episode =>
      episode.title.toLowerCase().includes(search) ||
      episode.description.toLowerCase().includes(search)
    );

    renderEpisodes(filtered);
  });


// ---------------------------
// PATREON-MEDLEMMAR
// ---------------------------

async function loadMembers() {
  const container = document.getElementById("members");

  try {
    const response = await fetch("members.json");

    if (!response.ok) {
      throw new Error("Kunde inte hämta medlemslistan.");
    }

    const data = await response.json();

    const members = data.members.filter(member => member.visible === true);

    if (members.length === 0) {
      container.innerHTML = "<p>Våra Synkare presenteras här snart!</p>";
      return;
    }

    container.innerHTML = members.map(member => `
      <div class="member">
        💚 ${escapeHTML(member.name)}
      </div>
    `).join("");

  } catch (error) {
    console.error(error);
    container.innerHTML = "<p>Medlemslistan kunde inte laddas.</p>";
  }
}


// ---------------------------
// STARTA HEMSIDAN
// ---------------------------

document.addEventListener("DOMContentLoaded", () => {
  loadEpisodes();
  loadMembers();
});