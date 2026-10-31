const API_BASE = 'https://notesmp-api.notesmp-de.workers.dev/v1';
const SERVER_ADDRESS = 'NoteSMP.de';
const app = document.querySelector('#app');
const nav = document.querySelector('.portal-nav');
const menuButton = document.querySelector('.nav-toggle');
const toast = document.querySelector('.toast');
const routeTitles = { '/': 'Home', '/events': 'Events', '/gallery': 'Gallery', '/players': 'Players', '/commands': 'Commands', '/rules': 'Rules' };
let serverData = null;
let playerData = [];
let playerLoadFailed = false;
let selectedGalleryGroup = 'Events';
let toastTimer;

function safeText(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

function formatDate(value) {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not recorded' : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatPlaytime(seconds) {
  const hours = Math.floor(Math.max(0, Number(seconds) || 0) / 3600);
  return `${formatNumber(hours)} hr`;
}

function getMotd(value) {
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value?.clean)) return value.clean.join(' ').trim();
  if (typeof value?.clean === 'string') return value.clean.trim();
  return '';
}

function currentPath() {
  return window.location.pathname.replace(/\/$/, '') || '/';
}

function toastMessage(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('show'), 2200);
}

function serverStatusMarkup() {
  const online = Boolean(serverData?.online);
  const count = Number(serverData?.playersOnline || 0);
  const max = Number(serverData?.maxPlayers || 0);
  const motd = getMotd(serverData?.motd);
  const statusText = serverData?.unavailable ? 'STATUS UNAVAILABLE' : (serverData ? (online ? 'ONLINE' : 'OFFLINE') : 'CHECKING STATUS');
  const playerText = serverData && online ? `${count}${max ? ` / ${max}` : ''} online` : 'Java Edition server';
  const version = serverData?.version || '26.3';
  const motdText = serverData?.unavailable ? 'Server details could not be reached. Try again shortly.' : (serverData ? (motd ? safeText(motd) : 'No message of the day is configured.') : 'Fetching live server details…');
  return `<section class="panel" aria-labelledby="status-heading"><div class="panel-heading"><div><span class="overline">LIVE SERVER</span><h2 id="status-heading">Server status</h2></div><span class="status-meta">${safeText(version)}</span></div><div class="panel-body"><div class="status-top"><span class="status-indicator ${serverData && !serverData.unavailable ? (online ? 'is-online' : 'is-offline') : ''}"><span class="status-dot"></span><span>${statusText}</span></span><span class="status-meta">${safeText(playerText)}</span></div><div class="address-row"><div><span class="overline">JAVA SERVER ADDRESS</span><strong class="server-ip">${SERVER_ADDRESS}</strong></div><button class="copy-button" id="copy-address" type="button">Copy IP</button></div><p class="motd">${motdText}</p><div class="quick-stats"><div class="quick-stat"><span class="metric-label">Edition</span><strong class="metric-value">Java</strong></div><div class="quick-stat"><span class="metric-label">Version</span><strong class="metric-value">${safeText(version)}</strong></div><div class="quick-stat"><span class="metric-label">Players</span><strong class="metric-value">${serverData && !serverData.unavailable && online ? formatNumber(count) : '—'}</strong></div></div></div></section>`;
}

function resourceLink(label, url, hint = 'Open') {
  if (!url) return `<div class="resource-link is-disabled" aria-disabled="true"><span>${safeText(label)}</span><span>${safeText(hint)}</span></div>`;
  return `<a class="resource-link" href="${safeText(url)}" target="_blank" rel="noreferrer"><span>${safeText(label)}</span><span aria-hidden="true">↗</span></a>`;
}

function homePage() {
  const onlineNames = (serverData?.onlinePlayers || []).map(player => safeText(typeof player === 'string' ? player : player.name || player.username)).filter(Boolean);
  return `<div class="page-shell"><section class="home-hero" aria-labelledby="home-title"><div class="home-hero-content"><span class="eyebrow">NOTE SMP · JAVA EDITION 26.3</span><h1 id="home-title">Your world.<br>Your people.</h1><p>Everything happening on NoteSMP, in one place. Check the server, find your next event, and see what the community is building.</p><div class="hero-buttons"><a class="button-primary" href="/players">Explore players <span aria-hidden="true">→</span></a><a class="button-secondary" href="/events">See events <span aria-hidden="true">↗</span></a></div></div></section><div class="home-layout"><div class="main-column">${serverStatusMarkup()}<section class="panel"><div class="panel-heading"><div><span class="overline">SERVER UPDATES</span><h2>Announcements</h2></div><a class="text-link" href="/events">All updates ↗</a></div><div class="empty-state"><strong>Announcement feed not connected yet</strong>Critical maintenance alerts and server news will appear here once connected.</div></section><section><div class="home-section-heading"><div><span class="overline">COMMUNITY CALENDAR</span><h2>Upcoming events</h2></div><a class="text-link" href="/events">View all ↗</a></div><div class="panel"><div class="empty-state"><strong>Events are on the way</strong>Upcoming and past events will appear here when the Discord event feed is connected.</div></div></section><section><div class="home-section-heading"><div><span class="overline">ON THE SERVER</span><h2>Creators</h2></div></div><div class="panel creator-empty"><p>The NoteSMP creator roster and stream status will appear here.</p><span class="status-meta">STREAMS NOT CONNECTED</span></div></section></div><aside class="side-column"><section class="panel"><div class="panel-heading"><div><span class="overline">SERVER LINKS</span><h2>Find your way in</h2></div></div><div class="link-list">${resourceLink('BlueMap', null, 'Link not set')}${resourceLink('Modpack', null, 'Link not set')}${resourceLink('YouTube', null, 'Link not set')}${resourceLink('Discord community', null, 'Invite not set')}</div></section><section class="panel"><div class="panel-heading"><div><span class="overline">ONLINE NOW</span><h2>Players in the world</h2></div><a class="text-link" href="/players">Players ↗</a></div><div class="empty-state" id="online-players">${onlineNames.length ? onlineNames.join(', ') : 'Live player names will show here when the server reports them.'}</div></section><section class="panel"><div class="panel-heading"><div><span class="overline">SERVER GUIDE</span><h2>New around here?</h2></div></div><div class="link-list"><a class="resource-link" href="/rules"><span>Read the rules</span><span aria-hidden="true">→</span></a><a class="resource-link" href="/commands"><span>Useful commands</span><span aria-hidden="true">→</span></a><a class="resource-link" href="/gallery"><span>Explore the gallery</span><span aria-hidden="true">→</span></a></div></aside></div></div>`;
}

function pageHeading(title, description, eyebrow) {
  return `<header class="page-heading"><div><span class="overline">${safeText(eyebrow)}</span><h1>${safeText(title)}</h1><p>${safeText(description)}</p></div></header>`;
}

function emptyPage(title, message) {
  return `<div class="panel"><div class="empty-state"><strong>${safeText(title)}</strong>${safeText(message)}</div></div>`;
}

function eventsPage() {
  return `<div class="page-shell">${pageHeading('Events', 'Upcoming plans and moments from the NoteSMP community, with past events kept close by.', 'COMMUNITY CALENDAR')}<div class="page-content"><div class="gallery-groups" aria-label="Event time period"><button class="gallery-group" type="button" aria-pressed="true">Upcoming</button><button class="gallery-group" type="button" aria-pressed="false">Past events</button></div>${emptyPage('Event feed not connected yet', 'Events will be synced from the NoteSMP Discord bot. Events with photos will link directly to their gallery collection.')}</div></div>`;
}

function galleryPage() {
  const groups = ['Events', 'Buildings', 'Places'];
  return `<div class="page-shell">${pageHeading('Gallery', 'A growing archive of builds, places, and shared server moments.', 'FROM THE WORLD')}<div class="page-content"><div class="gallery-groups" aria-label="Gallery categories">${groups.map(group => `<button class="gallery-group" type="button" data-gallery-group="${group}" aria-pressed="${selectedGalleryGroup === group}">${group}</button>`).join('')}</div>${emptyPage(`${selectedGalleryGroup} gallery is empty`, 'Images will be added by the NoteSMP team through Discord. Each collection will keep its event or location context.')}</div></div>`;
}

function playerListPage() {
  return `<div class="page-shell">${pageHeading('Players', 'Search the player directory and compare the stats recorded by the server.', 'PLAYER DIRECTORY')}<div class="page-content"><div class="toolbar"><input class="search-input" id="player-search" type="search" placeholder="Search players…" aria-label="Search players"><select class="sort-select" id="player-sort" aria-label="Sort players"><option value="playtime_seconds">Most playtime</option><option value="blocks_placed">Blocks placed</option><option value="blocks_broken">Blocks broken</option><option value="kills">Kills</option><option value="deaths">Deaths</option></select><span class="player-count" id="player-count">Loading player list…</span></div><div id="player-results">${emptyPage('Loading players', 'Connecting to the NoteSMP player API…')}</div><p class="fine-print">Player records include playtime, blocks placed and broken, kills, deaths, and join activity. The current public API returns up to 100 players.</p></div></div>`;
}

function playerProfilePage(uuid) {
  return `<div class="page-shell">${pageHeading('Player profile', 'In-game statistics collected by the NoteSMP server.', 'PLAYER DIRECTORY')}<div class="page-content" id="player-profile" data-uuid="${safeText(uuid)}">${emptyPage('Loading profile', 'Fetching player statistics…')}</div></div>`;
}

function commandsPage() {
  const nativeCommands = [['/help', 'Show available commands. The list depends on your permissions and installed server plugins.'], ['/msg <player> <message>', 'Send a private message to another player.'], ['/tell <player> <message>', 'Vanilla alias for sending a private message.'], ['/w <player> <message>', 'Vanilla alias for sending a private message.'], ['/teammsg <message>', 'Send a message to your current team, when teams are enabled.'], ['/me <action>', 'Send a third-person action message in chat.']];
  return `<div class="page-shell">${pageHeading('Commands', 'A quick reference grouped by where each command comes from.', 'PLAYER GUIDE')}<div class="page-content"><section class="command-heritage"><header class="command-heritage-heading"><div><span class="overline">NATIVE COMMANDS</span><h2>Minecraft: Java Edition</h2></div><span class="status-meta">VANILLA</span></header><div class="command-list">${nativeCommands.map(([command, description]) => `<article class="command-item"><code>${safeText(command)}</code><p>${safeText(description)}</p></article>`).join('')}</div></section><section class="command-heritage"><header class="command-heritage-heading"><div><span class="overline">PLUGIN COMMANDS</span><h2>Server plugins</h2></div></header><div class="panel"><div class="empty-state"><strong>Plugin command list not configured</strong>Once the server plugin list is confirmed, commands will be grouped here under each plugin's name.</div></div></section><p class="fine-print">Native command availability can vary by server configuration and player permissions. Plugin commands will be documented only after the installed plugins are confirmed.</p></div></div>`;
}

function rulesPage() {
  return `<div class="page-shell">${pageHeading('Rules', 'The current community rules belong here, so there is one clear source of truth.', 'PLAY FAIR')}<div class="page-content">${emptyPage('Discord rules feed not connected yet', 'The official rules will be synced from the NoteSMP Discord channel. Until they appear here, check the community Discord before playing.')}</div></div>`;
}

function render() {
  const path = currentPath();
  const profileMatch = path.match(/^\/players\/([0-9a-fA-F-]{36})$/);
  const knownRoute = routeTitles[path] ? path : (profileMatch ? '/players' : '/');
  document.title = `${profileMatch ? 'Player profile' : routeTitles[knownRoute]} | NoteSMP`;
  nav?.querySelectorAll('[data-route]').forEach(link => {
    if (link.dataset.route === knownRoute) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  if (!app) return;
  if (profileMatch) app.innerHTML = playerProfilePage(profileMatch[1]);
  else if (knownRoute === '/') app.innerHTML = homePage();
  else if (knownRoute === '/events') app.innerHTML = eventsPage();
  else if (knownRoute === '/gallery') app.innerHTML = galleryPage();
  else if (knownRoute === '/players') app.innerHTML = playerListPage();
  else if (knownRoute === '/commands') app.innerHTML = commandsPage();
  else if (knownRoute === '/rules') app.innerHTML = rulesPage();
  closeMenu();
  if (knownRoute === '/players' && !profileMatch) loadPlayers();
  if (profileMatch) renderPlayerProfile(profileMatch[1]);
}

function navigate(path) {
  if (window.location.pathname === path) return;
  window.history.pushState({}, '', path);
  render();
  window.scrollTo(0, 0);
}

function closeMenu() {
  nav?.classList.remove('is-open');
  menuButton?.setAttribute('aria-expanded', 'false');
  menuButton?.setAttribute('aria-label', 'Open navigation');
}

async function fetchServerStatus() {
  try {
    const response = await fetch(`${API_BASE}/server`, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('Status unavailable');
    serverData = await response.json();
  } catch {
    serverData = { unavailable: true };
  }
  if (currentPath() === '/') render();
}

function getSortedPlayers() {
  const search = document.querySelector('#player-search')?.value.trim().toLowerCase() || '';
  const sortBy = document.querySelector('#player-sort')?.value || 'playtime_seconds';
  return playerData.filter(player => String(player.username || '').toLowerCase().includes(search)).sort((left, right) => Number(right[sortBy] || 0) - Number(left[sortBy] || 0));
}

function renderPlayers() {
  const results = document.querySelector('#player-results');
  const count = document.querySelector('#player-count');
  if (!results || !count) return;
  if (!playerData.length) {
    count.textContent = playerLoadFailed ? 'Unavailable' : '0 players';
    results.innerHTML = playerLoadFailed
      ? emptyPage('Player list unavailable', 'The public player API could not be reached. Try again in a moment.')
      : emptyPage('No player records yet', 'Player statistics will appear here after players join the server.');
    return;
  }
  const filtered = getSortedPlayers();
  count.textContent = `${filtered.length} of ${playerData.length} players`;
  if (!filtered.length) {
    results.innerHTML = emptyPage('No players match', 'Try another player name.');
    return;
  }
  results.innerHTML = `<div class="table-wrap"><table class="player-table"><thead><tr><th>Player</th><th class="numeric">Playtime</th><th class="numeric">Placed</th><th class="numeric">Broken</th><th class="numeric">Kills</th><th class="numeric">Deaths</th></tr></thead><tbody>${filtered.map(player => `<tr><td><a class="player-name" href="/players/${encodeURIComponent(player.uuid)}">${safeText(player.username)}</a></td><td class="numeric">${formatPlaytime(player.playtime_seconds)}</td><td class="numeric">${formatNumber(player.blocks_placed)}</td><td class="numeric">${formatNumber(player.blocks_broken)}</td><td class="numeric">${formatNumber(player.kills)}</td><td class="numeric">${formatNumber(player.deaths)}</td></tr>`).join('')}</tbody></table></div>`;
}

async function loadPlayers() {
  try {
    const response = await fetch(`${API_BASE}/players?limit=100`, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('Player list unavailable');
    const data = await response.json();
    playerData = Array.isArray(data.players) ? data.players : [];
    playerLoadFailed = false;
  } catch {
    playerData = [];
    playerLoadFailed = true;
  }
  renderPlayers();
}

async function renderPlayerProfile(uuid) {
  const profile = document.querySelector('#player-profile');
  if (!profile) return;
  try {
    const response = await fetch(`${API_BASE}/players/${encodeURIComponent(uuid)}`, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('Player not found');
    const data = await response.json();
    const player = data.player;
    if (!player) throw new Error('Player not found');
    profile.innerHTML = `<a class="back-link" href="/players">← All players</a><div class="panel"><div class="panel-heading"><div><span class="overline">PLAYER PROFILE</span><h2>${safeText(player.username)}</h2></div><span class="status-meta">Updated ${safeText(formatDate(player.updated_at))}</span></div><div class="panel-body"><div class="detail-grid"><div class="detail-stat"><span>Playtime</span><strong>${safeText(formatPlaytime(player.playtime_seconds))}</strong></div><div class="detail-stat"><span>Blocks placed</span><strong>${formatNumber(player.blocks_placed)}</strong></div><div class="detail-stat"><span>Blocks broken</span><strong>${formatNumber(player.blocks_broken)}</strong></div><div class="detail-stat"><span>Kills</span><strong>${formatNumber(player.kills)}</strong></div><div class="detail-stat"><span>Deaths</span><strong>${formatNumber(player.deaths)}</strong></div><div class="detail-stat"><span>First joined</span><strong>${safeText(formatDate(player.first_join))}</strong></div><div class="detail-stat"><span>Last seen</span><strong>${safeText(formatDate(player.last_seen))}</strong></div></div></div></div>`;
  } catch {
    profile.innerHTML = `<a class="back-link" href="/players">← All players</a>${emptyPage('Player profile unavailable', 'This player could not be found or the player API is unavailable.')}`;
  }
}

function closeMenu() {
  nav?.classList.remove('is-open');
  menuButton?.setAttribute('aria-expanded', 'false');
  menuButton?.setAttribute('aria-label', 'Open navigation');
}

document.addEventListener('click', event => {
  const routeLink = event.target.closest('a[href^="/"]');
  if (routeLink && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && routeLink.target !== '_blank') {
    event.preventDefault();
    navigate(routeLink.getAttribute('href'));
    return;
  }
  if (event.target.closest('#copy-address')) {
    navigator.clipboard?.writeText(SERVER_ADDRESS).then(() => toastMessage('Server address copied.')).catch(() => toastMessage(`Server address: ${SERVER_ADDRESS}`));
  }
  const groupButton = event.target.closest('[data-gallery-group]');
  if (groupButton) {
    selectedGalleryGroup = groupButton.dataset.galleryGroup;
    render();
  }
  if (event.target.closest('.gallery-groups button') && !groupButton) {
    const buttons = [...event.target.closest('.gallery-groups').querySelectorAll('button')];
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button === event.target)));
  }
});

document.addEventListener('input', event => {
  if (event.target.matches('#player-search')) renderPlayers();
});
document.addEventListener('change', event => {
  if (event.target.matches('#player-sort')) renderPlayers();
});
window.addEventListener('popstate', render);
menuButton?.addEventListener('click', () => {
  const isOpen = nav?.classList.toggle('is-open') || false;
  menuButton.setAttribute('aria-expanded', String(isOpen));
  menuButton.setAttribute('aria-label', isOpen ? 'Close navigation' : 'Open navigation');
});
document.querySelector('#year').textContent = new Date().getFullYear();
render();
fetchServerStatus();
window.setInterval(fetchServerStatus, 60_000);
