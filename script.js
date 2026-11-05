const API_BASE = 'https://notesmp-api.notesmp-de.workers.dev/v1';
const SERVER_ADDRESS = 'NoteSMP.de';
const app = document.querySelector('#app');
const nav = document.querySelector('.portal-nav');
const menuButton = document.querySelector('.nav-toggle');
const toast = document.querySelector('.toast');
const routeTitles = { '/': 'Info', '/events': 'Events', '/gallery': 'Gallery', '/players': 'Players', '/commands': 'Commands', '/rules': 'Rules', '/devlog': 'Updates' };
let serverData = null;
let pluginAvailable = false;
let lastPluginRefreshSignal = 0;
let playerData = [];
let playerLoadFailed = false;
let selectedGalleryGroup = 'Events';
let toastTimer;

function safeText(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function safeWebUrl(value) {
  if (typeof value !== 'string' || !/^https?:\/\//i.test(value)) return '';
  return safeText(value);
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

function getDiscordEventState(event = {}) {
  const rawStatus = event.status ?? event.eventStatus ?? event.discordStatus ?? event.event_status;
  const statusNumber = Number(rawStatus);
  const explicitText = String(event.statusText ?? event.status_text ?? "").toLowerCase().trim();
  const rawText = String(rawStatus ?? "").toLowerCase().trim();
  // Explicit terminal text must win over a stale numeric "active" status.
  if ([explicitText, rawText].some(value => value.includes("cancel") || value.includes("complet") || value.includes("ended")) || statusNumber === 3 || statusNumber === 4) return "ended";
  if ([explicitText, rawText].some(value => value.includes("active") || value.includes("started")) || statusNumber === 2) return "started";
  return "scheduled";
}


function formatDate(value) {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not recorded' : date.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatPlaytime(seconds) {
  let total = Math.floor(Math.max(0, Number(seconds) || 0) / 60);
  const days = Math.floor(total / 1440); total %= 1440;
  const hours = Math.floor(total / 60); const minutes = total % 60;
  return [days ? `${days}d` : '', hours ? `${hours}h` : '', `${minutes}m`].filter(Boolean).join(' ');
}

function getMotd(value) {
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value?.raw)) return value.raw.join('\n').trim();
  if (Array.isArray(value?.clean)) return value.clean.join('\n').trim();
  if (typeof value?.raw === 'string') return value.raw.trim();
  if (typeof value?.clean === 'string') return value.clean.trim();
  return '';
}

function motdHtml(value) {
  const input = getMotd(value);
  const colors = {'0':'#000000','1':'#0000AA','2':'#00AA00','3':'#00AAAA','4':'#AA0000','5':'#AA00AA','6':'#FFAA00','7':'#AAAAAA','8':'#555555','9':'#5555FF','a':'#55FF55','b':'#55FFFF','c':'#FF5555','d':'#FF55FF','e':'#FFFF55','f':'#FFFFFF'};
  let color='',bold=false,italic=false,underline=false,strike=false,out='',plain='';
  const flush=()=>{if(!plain)return;let t=safeText(plain).replace(/\n/g,'<br>').replace(/\\n/g,'<br>');const css=[];if(color)css.push('color:'+color);if(bold)css.push('font-weight:700');if(italic)css.push('font-style:italic');if(underline)css.push('text-decoration:underline');if(strike)css.push('text-decoration:line-through');out+=css.length?'<span style="'+css.join(';')+'">'+t+'</span>':t;plain='';};
  for(let i=0;i<input.length;i++){if(input[i]==='§'&&i+1<input.length){const c=input[++i].toLowerCase();if(c==='x'&&/^§x(?:§[0-9a-f]){6}/i.test(input.slice(i-1))){const hex=input.slice(i+1,i+13).replace(/§/g,'');flush();color='#'+hex;bold=italic=underline=strike=false;i+=12;continue;}if(colors[c]){flush();color=colors[c];bold=italic=underline=strike=false;continue;}if(c==='r'){flush();color='';bold=italic=underline=strike=false;continue;}if(c==='l'){flush();bold=true;continue;}if(c==='o'){flush();italic=true;continue;}if(c==='n'){flush();underline=true;continue;}if(c==='m'){flush();strike=true;continue;}plain+='§'+c;continue;}plain+=input[i];}flush();return out;
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
  const playerText = serverData && !serverData.unavailable ? `${count}/${max || '—'}` : '—';
  const version = serverData?.version || '26.3';
  const motdText = serverData?.unavailable ? 'Server details could not be reached. Try again shortly.' : (serverData ? (motd ? motdHtml(motd) : 'No message of the day is configured.') : 'Fetching live server details…');
  return `<section class="panel" aria-labelledby="status-heading"><div class="panel-heading"><div><span class="overline">LIVE SERVER</span><h2 id="status-heading">Server status</h2></div></div><div class="panel-body"><div class="status-top"><span class="status-indicator ${serverData && !serverData.unavailable ? (online ? 'is-online' : 'is-offline') : ''}"><span class="status-dot"></span><span>${statusText}</span></span></div><div class="address-row"><div><span class="overline">JAVA SERVER ADDRESS</span><strong class="server-ip">${SERVER_ADDRESS}</strong></div><button class="copy-button" id="copy-address" type="button">Copy IP</button></div><p class="motd">${motdText}</p><div class="quick-stats"><div class="quick-stat"><span class="metric-label">Edition</span><strong class="metric-value">Java</strong></div><div class="quick-stat"><span class="metric-label">Version</span><strong class="metric-value">${safeText(version)}</strong></div><div class="quick-stat"><span class="metric-label">Players</span><strong class="metric-value">${playerText}</strong></div></div></div></section>`;
}

function linkIcon(key) {
  const attrs = 'viewBox="0 0 24 24" aria-hidden="true" focusable="false"';
  const paths = {
    discord: '<path fill="currentColor" d="M19.7 5.2a18 18 0 0 0-4.4-1.4l-.6 1.2a16 16 0 0 0-5.4 0l-.6-1.2a18 18 0 0 0-4.4 1.4C1.5 9.3.8 13.3 1.2 17.2a18 18 0 0 0 5.4 2.7l1.2-1.9-1.9-.9.5-.4a13 13 0 0 0 11.2 0l.5.4-1.9.9 1.2 1.9a18 18 0 0 0 5.4-2.7c.5-4.5-.8-8.4-3.1-12ZM8.7 14.8c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Zm6.6 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Z"/>',
    youtube: '<path fill="currentColor" d="M23 7.1a3 3 0 0 0-2.1-2.1C19 4.5 12 4.5 12 4.5s-7 0-8.9.5A3 3 0 0 0 1 7.1 31 31 0 0 0 .5 12s0 3.4.5 4.9a3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1c.5-1.5.5-4.9.5-4.9s0-3.4-.5-4.9ZM9.7 15.5v-7l6 3.5-6 3.5Z"/>',
    modpack: '<path fill="currentColor" d="M12 2 2.5 7v10L12 22l9.5-5V7L12 2Zm0 2.5 6.8 3.6-6.8 3.5L5.2 8.1 12 4.5Zm-7 5.3 6 3.1v6.1l-6-3.2V9.8Zm8 9.2v-6.1l6-3.1v6l-6 3.2Z"/>',
    bluemap: '<path fill="currentColor" d="M3 3h18v18H3V3Zm3 3v12h12V6H6Zm2 2h8v2H8V8Zm0 4h8v2H8v-2Z"/>'
  };
  return '<svg ' + attrs + '>' + (paths[key] || paths.bluemap) + '</svg>';
}
function resourceLink(label, url, hint = 'Open') {
  const key = String(label || '').toLowerCase();
  if (!url) return `<div class="resource-link is-disabled" data-link-key="${safeText(key)}" aria-disabled="true"><span>${safeText(label)}</span><span>${safeText(hint)}</span></div>`;
  return `<a class="resource-link" data-link-key="${safeText(key)}" href="${safeText(url)}" target="_blank" rel="noreferrer"><span>${safeText(label)}</span><span aria-hidden="true">↗</span></a>`;
}

function homePage() {
  const onlineNames = (serverData?.onlinePlayers || []).map(player => { const name = typeof player === 'string' ? player : player.name || player.username; const uuid = typeof player === 'object' ? player.uuid || player.id : ''; if (!name) return ''; const avatar = uuid ? 'https://crafatar.com/avatars/' + encodeURIComponent(uuid) + '?size=32&overlay' : 'https://mc-heads.net/avatar/' + encodeURIComponent(name) + '/32'; return '<a class="online-player" href="/players?name=' + encodeURIComponent(name) + '"><img src="' + avatar + '" alt="" loading="lazy"><span>' + safeText(name) + '</span></a>'; }).filter(Boolean);
  return `<div class="page-shell"><section class="home-hero" aria-labelledby="home-title"><div class="home-hero-content"><span class="eyebrow">NOTE SMP · JAVA EDITION 26.3</span><h1 id="hero-title" hidden>Your world. Your people.</h1><p id="hero-subtitle" hidden>Everything happening on NoteSMP, in one place. Check the server, find your next event, and see what the community is building.</p><div class="hero-buttons"><a class="button-primary" href="/players">Explore players <span aria-hidden="true">→</span></a><a class="button-secondary" href="/events">See events <span aria-hidden="true">↗</span></a></div></div><div class="hero-event-slot" id="hero-event" hidden></div></section><section class="home-news-section panel" id="home-news" aria-label="News" hidden><div id="home-news-feed" class="home-news-feed"></div></section><div class="home-layout"><div class="main-column">${serverStatusMarkup()}<section class="panel" id="section-server-updates"><div class="panel-heading"><div><span class="overline">Server Updates</span><h2>Latest Update</h2></div><a class="text-link" href="/devlog">All updates ↗</a></div><div class="empty-state"><strong>Announcement feed not connected yet</strong>Critical maintenance alerts and server news will appear here once connected.</div></section><section id="section-events"><div class="home-section-heading"><div><span class="overline">Events</span><h2>Upcoming Events</h2></div><a class="text-link" href="/events">View all ↗</a></div><div class="panel"><div class="empty-state"><strong>Events are on the way</strong>Upcoming and past events will appear here when the Discord event feed is connected.</div></div></section></div><aside class="side-column"><section class="panel" id="section-server-links"><div class="panel-heading"><div><span class="overline">Server Links</span><h2>Find your way in</h2></div></div><div class="link-list">${resourceLink('Discord', null, 'Invite not set')}${resourceLink('YouTube', null, 'Link not set')}${resourceLink('Modpack', null, 'Link not set')}${resourceLink('BlueMap', null, 'Link not set')}${resourceLink('Donate', null, 'Donation link not set')}</div></section><section class="panel" id="section-online-now"><div class="panel-heading"><div><span class="overline">Online Now</span><h2>Players in the world</h2></div><a class="text-link" href="/players">Players ↗</a></div><div class="empty-state" id="online-players">${onlineNames.length ? onlineNames.join('') : 'Live player names will show here when the server reports them.'}</div></section><section class="panel" id="section-creators"><div class="panel-heading"><div><span class="overline">Creators</span><h2>See who is live</h2></div></div><div class="link-list"><div class="resource-link is-disabled" aria-disabled="true"><span>Creator roster</span><span>Coming soon</span></div><div class="resource-link is-disabled" aria-disabled="true"><span>Live streams</span><span>Coming soon</span></div></div></aside></div></div>`;
}

function pageHeading(title, description, eyebrow) {
  return `<header class="page-heading"><div><span class="overline">${safeText(eyebrow)}</span><h1>${safeText(title)}</h1><p>${safeText(description)}</p></div></header>`;
}

function emptyPage(title, message) {
  return `<div class="panel"><div class="empty-state"><strong>${safeText(title)}</strong>${safeText(message)}</div></div>`;
}

function eventsPage() {
  return `<div class="page-shell">${pageHeading('Events', 'Upcoming plans and moments from the NoteSMP community, with past events kept close by.', 'COMMUNITY CALENDAR')}<div class="page-content"><section class="event-period-section"><h2 class="event-period-heading">Upcoming</h2><div id="upcoming-events-feed">${emptyPage('Loading upcoming events', 'Fetching the Discord event schedule…')}</div></section><section class="event-period-section"><h2 class="event-period-heading">Past events</h2><div id="past-events-feed">${emptyPage('Loading past events', 'Fetching previous Discord events…')}</div></section></div></div>`;
}

function galleryPage() {
  const groups = ['Events', 'Buildings', 'Places', 'In Progress'];
  return `<div class="page-shell">${pageHeading('Gallery', 'A growing archive of builds, places, and shared server moments.', 'FROM THE WORLD')}<div class="page-content"><div class="gallery-groups" aria-label="Gallery categories">${groups.map(group => `<button class="gallery-group" type="button" data-gallery-group="${group}" aria-pressed="${selectedGalleryGroup === group}">${group}</button>`).join('')}</div>${emptyPage(`${selectedGalleryGroup} gallery is empty`, 'Gallery entries and in-progress projects will appear here after the NoteSMP bot publishes Discord posts.')}</div></div>`;
}

function playerListPage() {
  return `<div class="page-shell">${pageHeading('Players', 'Browse the players who have joined NoteSMP.', 'PLAYER DIRECTORY')}<div class="page-content"><div class="toolbar"><input class="search-input" id="player-search" type="search" aria-label="Search players" placeholder="Search by player name"><span class="player-count" id="player-count" aria-live="polite"></span></div><div id="player-results"></div></div></div>`;
}

function playerProfilePage(uuid) {
  return `<div class="page-shell">${pageHeading('Player profile', 'In-game statistics collected by the NoteSMP server.', 'PLAYER DIRECTORY')}<div class="page-content" id="player-profile" data-uuid="${safeText(uuid)}">${emptyPage('Loading profile', 'Fetching player statistics…')}</div></div>`;
}

function commandsPage() {
  const groups = [
    {
      name: 'Vanilla',
      category: 'Minecraft Java Edition',
      source: 'NATIVE',
      commands: [['/help', 'Show available commands. The list depends on your permissions and installed server plugins.'], ['/msg <player> <message>', 'Send a private message to another player.'], ['/tell <player> <message>', 'Vanilla alias for sending a private message.'], ['/w <player> <message>', 'Vanilla alias for sending a private message.'], ['/teammsg <message>', 'Send a message to your current team, when teams are enabled.'], ['/me <action>', 'Send a third-person action message in chat.']]
    },
    {
      name: 'GSit',
      category: 'Plugin commands',
      source: 'PLUGIN',
      commands: [['/sit', 'Sit on the block or seat in front of you.'], ['/crawl', 'Crawl along the ground.'], ['/lay', 'Lie down in place.'], ['/spin', 'Spin in place.']]
    }
  ];
  const commandCount = groups.reduce((count, group) => count + group.commands.length, 0);
  const groupMarkup = groups.map(group => `<section class="command-heritage" data-command-group data-group-search="${safeText(`${group.name} ${group.category} ${group.source}`.toLowerCase())}"><header class="command-heritage-heading"><div><span class="overline">${safeText(group.category)}</span><h2>${safeText(group.name)}</h2></div><span class="status-meta">${safeText(group.source)}</span></header><div class="command-list">${group.commands.map(([command, description]) => `<article class="command-item" data-command-search="${safeText(`${group.name} ${group.category} ${command} ${description}`.toLowerCase())}"><code>${safeText(command)}</code><p>${safeText(description)}</p></article>`).join('')}</div></section>`).join('');
  return `<div class="page-shell">${pageHeading('Commands', 'Search by command, category, or plugin.', 'PLAYER GUIDE')}<div class="page-content"><div class="toolbar"><input class="search-input" id="command-search" type="search" placeholder="Search commands or categories…" aria-label="Search commands or categories"><span class="player-count" id="command-count">${commandCount} commands</span></div><div id="command-groups">${groupMarkup}</div><div class="panel empty-state" id="command-no-results" hidden><strong>No matching commands</strong>Try a command, category, or plugin name.</div><p class="fine-print">Command availability depends on server configuration and player permissions. GSit commands listed here are enabled on NoteSMP.</p></div></div>`;
}

function devlogPage() {
  return `<div class="page-shell">${pageHeading('Updates', 'Announcements and development posts from the NoteSMP Discord server.', 'SERVER UPDATES')}<div class="page-content">${emptyPage('Devlog integration pending', 'The NoteSMP bot will publish posts from its Discord channel here once the bot integration is available.')}</div></div>`;
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
  else if (knownRoute === '/devlog') app.innerHTML = devlogPage();
  closeMenu();
  if (knownRoute === '/players' && !profileMatch) loadPlayers();
  if (knownRoute === '/commands') filterCommands();
  if (profileMatch) renderPlayerProfile(profileMatch[1]);
  window.dispatchEvent(new Event("notesmp:render"));
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
  if (currentPath() === '/') {
    const existing = document.querySelector('#status-heading')?.closest('.panel');
    if (existing) {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = serverStatusMarkup();
      existing.replaceWith(wrapper.firstElementChild);
    }
    const onlineSection = document.querySelector('#online-players');
    if (onlineSection) {
      const names = (serverData?.onlinePlayers || []).map(player => {
        const name = typeof player === 'string' ? player : player.name || player.username;
        const uuid = typeof player === 'object' ? player.uuid || player.id : '';
        if (!name) return '';
        const avatar = uuid ? 'https://crafatar.com/avatars/' + encodeURIComponent(uuid) + '?size=32&overlay' : 'https://mc-heads.net/avatar/' + encodeURIComponent(name) + '/32';
        return '<a class="online-player" href="/players?name=' + encodeURIComponent(name) + '"><img src="' + avatar + '" alt="" loading="lazy"><span>' + safeText(name) + '</span></a>';
      }).filter(Boolean);
      onlineSection.innerHTML = names.length ? names.join('') : 'No players are currently reported online.';
    }
  }
}

async function pollPluginRefreshSignal() {
  try {
    const response = await fetch(`${API_BASE}/server/plugin-state`, { cache: 'no-store' });
    if (!response.ok) throw new Error('Plugin state unavailable');
    const state = await response.json();
    const wasAvailable = pluginAvailable;
    pluginAvailable = Boolean(state.pluginAvailable);
    if (!wasAvailable && pluginAvailable) {
      const profileMatch = location.pathname.match(/^\/players\/([0-9a-fA-F-]{36})\/?$/);
      if (profileMatch) renderPlayerProfile(profileMatch[1]);
    }
    const signal = Number(state.refreshAt || 0);
    if (signal > lastPluginRefreshSignal) {
      lastPluginRefreshSignal = signal;
      await fetchServerStatus();
    }
  } catch { pluginAvailable = false; }
}

async function loadPlayers() {
  playerLoadFailed = false;
  const results = document.querySelector('#player-results');
  const count = document.querySelector('#player-count');
  if (results) results.innerHTML = '<div class="empty-state">Loading player data…</div>';
  if (count) count.textContent = '';
  try {
    const response = await fetch(`${API_BASE}/players?limit=100`, { headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (!response.ok) throw new Error('Player API request failed');
    const payload = await response.json();
    const records = Array.isArray(payload) ? payload : (payload.players || payload.data || payload.results || []);
    if (!Array.isArray(records)) throw new Error('Unexpected player API response');
    playerData = records.map(player => ({
      ...player,
      uuid: player.uuid || player.id || '',
      username: player.username || player.name || player.player_name || ''
    })).filter(player => player.username && player.uuid);
    renderPlayers();
    const params = new URLSearchParams(window.location.search);
    const search = params.get('name');
    const searchInput = document.querySelector('#player-search');
    if (search && searchInput) {
      searchInput.value = search;
      renderPlayers();
    }
  } catch {
    playerData = [];
    playerLoadFailed = true;
    renderPlayers();
  }
}

function getSortedPlayers() {
  const search = document.querySelector('#player-search')?.value.trim().toLowerCase() || '';
  return playerData.filter(player => String(player.username || '').toLowerCase().includes(search)).sort((left, right) => String(left.username || '').localeCompare(String(right.username || ''), undefined, { sensitivity: 'base' }));
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
  results.innerHTML = `<div class="player-directory">${filtered.map(player => `<a class="player-directory-card" href="/players/${encodeURIComponent(player.uuid)}"><img class="player-head-icon" src="https://mc-heads.net/avatar/${encodeURIComponent(player.uuid)}/48" alt="" loading="lazy"><span>${safeText(player.username)}</span></a>`).join("")}</div>`;
}

async function renderPlayerProfile(uuid, liveProfile = null) {
  const profile = document.querySelector('#player-profile');
  if (!profile) return;
  try {
    const response = await fetch(`${API_BASE}/players/${encodeURIComponent(uuid)}`, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('Player not found');
    const data = await response.json();
    const player = data.player;
    if (!player) throw new Error('Player not found');
    if (liveProfile?.baseStats) Object.assign(player, liveProfile.baseStats);
    if (liveProfile?.firstJoin) player.first_join = liveProfile.firstJoin;
    if (liveProfile?.lastSeen) player.last_seen = liveProfile.lastSeen;
    const statsResponse = liveProfile ? null : await fetch(`${API_BASE}/players/${encodeURIComponent(uuid)}/statistics`, { headers: { Accept: 'application/json' }, cache: 'no-store' });
    const statsPayload = liveProfile || (statsResponse?.ok ? await statsResponse.json() : { statistics: [] });
    const rawStatistics = Array.isArray(statsPayload.statistics) ? statsPayload.statistics : [];
    const statMap = new Map(rawStatistics.map(stat => [String(stat.stat_id || "").toLowerCase(), Number(stat.stat_value) || 0]));
    const read = key => statMap.get(key) || 0;
    const titleWords = raw => String(raw || "").split(/[_\s]+/).filter(Boolean).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
    const fmtDistance = value => (Number(value || 0) / 100).toLocaleString(undefined, { maximumFractionDigits: 2 }) + " m";
    const formatTicksDuration = ticks => { const totalSeconds = Math.floor(Math.max(0, Number(ticks) || 0) / 20); const days = Math.floor(totalSeconds / 86400); const hours = Math.floor((totalSeconds % 86400) / 3600); const minutes = Math.floor((totalSeconds % 3600) / 60); return [days ? days + "d" : "", hours ? hours + "h" : "", minutes ? minutes + "m" : ""].filter(Boolean).join(" ") || "0m"; };
    const sections = [
      ["General", [["Time Played", formatPlaytime(player.playtime_seconds)], ["Joined", formatDate(player.first_join)], ["Last Seen", formatDate(player.last_seen)], ["Mob Kills", read("mob_kills")], ["Player Kills", read("player_kills")], ["Number of Deaths", read("deaths")], ["Time Since Last Death", formatTicksDuration(read("time_since_last_death"))], ["Damage Absorbed", read("damage_absorbed")], ["Damage Dealt", read("damage_dealt")], ["Damage Resisted", read("damage_resisted")], ["Damage Taken", read("damage_taken")], ["Jumps", read("jumps")], ["Sneak Time", read("sneak_time")]]],
      ["Travel", [["Distance Climbed", fmtDistance(read("distance_climbed"))], ["Distance Crouched", fmtDistance(read("distance_crouched"))], ["Distance Fallen", fmtDistance(read("distance_fallen"))], ["Distance Flown", fmtDistance(read("distance_flown"))], ["Distance Sprinted", fmtDistance(read("distance_sprinted"))], ["Distance Swum", fmtDistance(read("distance_swum"))], ["Distance Walked", fmtDistance(read("distance_walked"))], ["Distance Walked under Water", fmtDistance(read("distance_walked_under_water"))], ["Distance by Boat", fmtDistance(read("distance_by_boat"))], ["Distance by Elytra", fmtDistance(read("distance_by_elytra"))], ["Distance by Happy Ghast", fmtDistance(read("distance_by_happy_ghast"))], ["Distance by Horse", fmtDistance(read("distance_by_horse"))], ["Distance by Minecart", fmtDistance(read("distance_by_minecart"))]]],
      ["Other", [["Blocks Placed", read("blocks_placed")], ["Blocks Broken", read("blocks_broken")], ["Fish Caught", read("fish_caught")], ["Animals Bred", read("animals_bred")], ["Chests Opened", read("chests_opened")], ["Barrels Opened", read("barrels_opened")], ["Shulker Boxes Opened", read("shulker_boxes_opened")], ["Items Dropped", read("items_dropped")], ["Items Enchanted", read("items_enchanted")], ["Talked to Villagers", read("talked_to_villagers")], ["Traded with Villagers", read("traded_with_villagers")], ["Time Since Last Rest", formatTicksDuration(read("time_since_last_rest"))], ["Times Slept in a Bed", read("times_slept_in_a_bed")]]]
    ];
    const statTable = rows => '<div class="table-wrap player-stat-table-wrap"><table class="player-stat-table"><tbody>' + rows.map(([label,value]) => '<tr><td>' + safeText(label) + '</td><td class="numeric">' + safeText(String(value ?? 0)) + '</td></tr>').join("") + '</tbody></table></div>';
    const sectionMarkup = sections.map(([name,rows]) => '<section class="player-stat-group"><h4>' + safeText(name) + '</h4>' + statTable(rows) + '</section>').join("");
    const mobMap = new Map(rawStatistics.filter(stat => String(stat.stat_id || "").toLowerCase().startsWith("mob_kill:")).map(stat => [String(stat.stat_id).slice(9).toLowerCase().replace(/^minecraft:/, ""), Number(stat.stat_value)||0]));
    const knownEntities = "allay,armadillo,armor_stand,axolotl,bat,bee,blaze,bogged,breeze,camel,cat,cave_spider,chicken,cod,cow,creeper,dolphin,donkey,drowned,elder_guardian,ender_dragon,enderman,endermite,evoker,fox,frog,ghast,glow_squid,goat,guardian,hoglin,horse,husk,iron_golem,llama,magma_cube,mooshroom,mule,ocelot,panda,parrot,phantom,pig,piglin,piglin_brute,pillager,polar_bear,pufferfish,rabbit,ravager,salmon,sheep,shulker,silverfish,skeleton,skeleton_horse,slime,sniffer,snow_golem,spider,squid,stray,strider,tadpole,trader_llama,tropical_fish,turtle,vex,villager,vindicator,wandering_trader,warden,witch,wither,wither_skeleton,wolf,zoglin,zombie,zombie_horse,zombie_villager,zombified_piglin".split(",");
    const mobRows = [...new Set(knownEntities.concat([...mobMap.keys()]))].map(id => ({id,count:mobMap.get(id)||0})).sort((a,b)=>a.id.localeCompare(b.id));
    const mobMarkup = '<section class="player-stat-group mob-kills-group"><h4>Mob Kills</h4><div class="mob-kill-grid">' + mobRows.map(row => '<div class="mob-kill-card" data-mob-wiki="' + safeText(row.id) + '" data-profile-search="mob kills ' + safeText(row.id) + '"><img class="mob-kill-icon" alt="" loading="lazy"><span>' + safeText(titleWords(row.id)) + '</span><strong>' + formatNumber(row.count) + '</strong></div>').join("") + '</div></section>';
    const statisticMarkup = sectionMarkup + mobMarkup;
    profile.innerHTML = `<a class="back-link" href="/players">← All players</a><div class="panel"><div class="panel-heading"><div><span class="overline">PLAYER PROFILE</span><h2 class="profile-name-with-head"><img class="player-head-icon" src="https://mc-heads.net/avatar/${encodeURIComponent(player.uuid || uuid)}/24" alt="" loading="lazy"><span>${safeText(player.username)}</span></h2></div><span class="status-meta">Updated ${safeText(formatDate(player.updated_at))}</span></div><div class="panel-body"><div class="player-profile-tabs" role="tablist" aria-label="Player profile sections"><button type="button" class="profile-tab is-active" role="tab" aria-selected="true" data-profile-tab="statistics">Statistics</button><button type="button" class="profile-tab" role="tab" aria-selected="false" data-profile-tab="advancements">Advancements</button><button type="button" class="profile-tab" role="tab" aria-selected="false" data-profile-tab="posts">Posts</button></div><input class="search-input profile-search" id="profile-search" type="search" placeholder="Search statistics…" aria-label="Search player profile data"><div class="player-profile-panel" data-profile-panel="statistics"><div class="player-stat-groups">${statisticMarkup}</div></div><div class="player-profile-panel" data-profile-panel="advancements" hidden><p class="fine-print">Loading earned advancements…</p></div><div class="player-profile-panel" data-profile-panel="posts" hidden><p class="fine-print">Loading posts mentioning this player as a builder…</p></div></div></div>`;
    const profileTabs = [...profile.querySelectorAll("[data-profile-tab]")];
    const profilePanels = [...profile.querySelectorAll("[data-profile-panel]")];
    const profileSearch = profile.querySelector("#profile-search");
    const filterProfilePanel = (tab, query) => {
      const panel = profile.querySelector('[data-profile-panel="' + tab + '"]');
      if (!panel) return;
      const items = [...panel.querySelectorAll("[data-profile-search]")];
      let visible = 0;
      items.forEach(item => { const match = !query || item.dataset.profileSearch.includes(query); item.hidden = !match; if (match) visible++; });
      const empty = panel.querySelector("[data-profile-empty]");
      if (empty) empty.hidden = visible > 0;
      if (tab === "statistics") panel.querySelectorAll(".player-stat-group").forEach(group => {
        group.hidden = ![...group.querySelectorAll("[data-profile-search]")].some(item => !item.hidden);
      });
    };
    const switchProfileTab = tab => {
      profileTabs.forEach(button => { const active = button.dataset.profileTab === tab; button.classList.toggle("is-active", active); button.setAttribute("aria-selected", String(active)); });
      profilePanels.forEach(panel => { panel.hidden = panel.dataset.profilePanel !== tab; });
      if (profileSearch) { profileSearch.placeholder = tab === "statistics" ? "Search statistics…" : tab === "advancements" ? "Search advancements…" : "Search posts…"; profileSearch.value = ""; }
      filterProfilePanel(tab, "");
    };
    profileTabs.forEach(button => button.addEventListener("click", () => switchProfileTab(button.dataset.profileTab)));
    profileSearch?.addEventListener("input", () => {
      const active = profile.querySelector("[data-profile-tab].is-active")?.dataset.profileTab || "statistics";
      filterProfilePanel(active, profileSearch.value.trim().toLowerCase());
    });
    profile.querySelectorAll(".player-stat-group li").forEach(item => {
      const groupName = item.closest(".player-stat-group")?.querySelector("h4")?.textContent || "";
      const statId = item.dataset.statId || "";
      item.dataset.profileSearch = (groupName + " " + statId + " " + item.textContent).toLowerCase();
    });
    // Batch Wiki lookups; a zero-inclusive profile can have hundreds of statistic rows.
    const iconImages = [...profile.querySelectorAll('img.player-stat-icon[data-wiki-icon]')];
    const iconLookup = new Map();
    const iconTitles = new Set();
    iconImages.forEach(image => {
      try { JSON.parse(image.dataset.wikiIcon || '[]').forEach(title => iconTitles.add(title)); } catch {}
    });
    const titles = [...iconTitles];
    for (let offset = 0; offset < titles.length; offset += 40) {
      const batch = titles.slice(offset, offset + 40);
      try {
        const url = 'https://minecraft.wiki/api.php?action=query&format=json&prop=imageinfo|pageimages&iiprop=url&piprop=thumbnail&pithumbsize=64&origin=*&titles=' + encodeURIComponent(batch.join('|'));
        const response = await fetch(url);
        if (!response.ok) continue;
        const payload = await response.json();
        Object.values(payload?.query?.pages || {}).forEach(page => {
          const imageUrl = page?.imageinfo?.[0]?.url || page?.thumbnail?.source;
          if (page?.title && imageUrl) iconLookup.set(page.title, imageUrl);
        });
      } catch {}
    }
    iconImages.forEach(image => {
      let candidates = [];
      try { candidates = JSON.parse(image.dataset.wikiIcon || '[]'); } catch {}
      const iconUrl = candidates.map(title => iconLookup.get(title)).find(Boolean);
      if (iconUrl) image.src = iconUrl;
      else image.remove();
    });
    // Resolve mob thumbnails from Minecraft Wiki's pageimages API, including redirected/canonical page titles.
    const mobCards = [...profile.querySelectorAll("[data-mob-wiki]")];
    for (let offset = 0; offset < mobCards.length; offset += 35) {
      const batch = mobCards.slice(offset, offset + 35);
      const requestedTitles = batch.map(card => titleWords(card.dataset.mobWiki).replace(/\s+/g, "_"));
      try {
        const url = "https://minecraft.wiki/api.php?action=query&format=json&redirects=1&prop=pageimages&piprop=thumbnail&pithumbsize=64&origin=*&titles=" + encodeURIComponent(requestedTitles.join("|"));
        const response = await fetch(url, { headers: { Accept: "application/json" } });
        if (!response.ok) throw new Error("Minecraft Wiki returned " + response.status);
        const payload = await response.json();
        const thumbnails = new Map();
        Object.values(payload?.query?.pages || {}).forEach(page => {
          const src = page?.thumbnail?.source;
          if (!src || !page?.title) return;
          const canonical = String(page.title).replace(/\s+/g, "_").toLowerCase();
          thumbnails.set(canonical, src);
        });
        (payload?.query?.normalized || []).forEach(entry => {
          const from = String(entry.from || "").replace(/\s+/g, "_").toLowerCase();
          const to = String(entry.to || "").replace(/\s+/g, "_").toLowerCase();
          if (thumbnails.has(to)) thumbnails.set(from, thumbnails.get(to));
        });
        (payload?.query?.redirects || []).forEach(entry => {
          const from = String(entry.from || "").replace(/\s+/g, "_").toLowerCase();
          const to = String(entry.to || "").replace(/\s+/g, "_").toLowerCase();
          if (thumbnails.has(to)) thumbnails.set(from, thumbnails.get(to));
        });
        batch.forEach((card, index) => {
          const image = card.querySelector(".mob-kill-icon");
          const title = requestedTitles[index].toLowerCase();
          const src = thumbnails.get(title);
          if (src && image) image.src = src;
          else if (image) image.remove();
        });
      } catch {
        batch.forEach(card => card.querySelector(".mob-kill-icon")?.remove());
      }
    }
    // Each profile table can be sorted independently by clicking any column heading.
    profile.querySelectorAll('.player-stat-table').forEach(table => {
      table.querySelectorAll('.stat-sort-button').forEach(button => {
        button.addEventListener('click', () => {
          const column = Number(button.dataset.sortColumn);
          const body = table.tBodies[0];
          if (!body) return;
          const ascending = button.dataset.sortDirection !== 'asc';
          table.querySelectorAll('.stat-sort-button').forEach(other => {
            if (other !== button) delete other.dataset.sortDirection;
            const arrow = other.querySelector('span');
            if (arrow && other !== button) arrow.textContent = '↕';
          });
          button.dataset.sortDirection = ascending ? 'asc' : 'desc';
          const arrow = button.querySelector('span');
          if (arrow) arrow.textContent = ascending ? '↑' : '↓';
          [...body.rows].sort((left,right) => {
            const a = left.cells[column]?.textContent.trim() || '';
            const b = right.cells[column]?.textContent.trim() || '';
            const numericA = Number(a.replace(/[,\s]/g,''));
            const numericB = Number(b.replace(/[,\s]/g,''));
            const result = a !== '' && b !== '' && Number.isFinite(numericA) && Number.isFinite(numericB)
              ? numericA - numericB : a.localeCompare(b, undefined, {numeric:true,sensitivity:'base'});
            return (ascending ? result : -result);
          }).forEach(row => body.append(row));
        });
      });
    });
    try {
      const [advResponse, postResponse] = await Promise.all([
        liveProfile ? Promise.resolve(null) : fetch(`${API_BASE}/players/${encodeURIComponent(uuid)}/advancements`, {cache:"no-store"}),
        fetch(`${API_BASE}/content/posts?category=gallery&builder=${encodeURIComponent(player.username)}&limit=1000`, {cache:"no-store"})
      ]);
      const advPayload = liveProfile || (advResponse?.ok ? await advResponse.json() : {advancements:[]});
      const earned = (Array.isArray(advPayload.advancements) ? advPayload.advancements : [])
        .map(item => ({
          id: item.advancement_id || item.advancementId || "",
          title: item.advancement_title || item.title || item.advancement_id || item.advancementId || "",
          earnedAt: item.earned_at || item.earnedAt || null,
          icon: item.icon_name || item.icon || item.iconName || ""
        }))
        .filter(item => item.id && !item.id.toLowerCase().startsWith("minecraft:recipes/"))
        .sort((a, b) => Date.parse(b.earnedAt || 0) - Date.parse(a.earnedAt || 0));
      const advPanel = profile.querySelector('[data-profile-panel="advancements"]');
      advPanel.innerHTML = earned.length ? earned.map(item => {
        const title = item.title || item.id;
        return '<article class="profile-search-row advancement-row" data-profile-search="' + safeText((title + " " + item.id).toLowerCase()) + '"><img class="advancement-icon" data-advancement-icon="' + safeText(item.icon) + '" alt="" loading="lazy"><div><strong>' + safeText(title) + '</strong><span>' + safeText(item.id) + '</span></div><small>' + safeText(formatDate(item.earnedAt)) + '</small></article>';
      }).join("") + '<p class="fine-print" data-profile-empty hidden>No matching advancements.</p>' : '<p class="fine-print">No earned advancements have been synced for this player yet.</p>';
      const advancementIcons = [...advPanel.querySelectorAll("[data-advancement-icon]")].filter(image => image.dataset.advancementIcon);
      for (let offset = 0; offset < advancementIcons.length; offset += 35) {
        const batch = advancementIcons.slice(offset, offset + 35);
        const requestedTitles = batch.map(image => titleWords(String(image.dataset.advancementIcon).split(":").pop()).replace(/\s+/g, "_"));
        try {
          const wikiUrl = "https://minecraft.wiki/api.php?action=query&format=json&redirects=1&prop=pageimages&piprop=thumbnail&pithumbsize=64&origin=*&titles=" + encodeURIComponent(requestedTitles.join("|"));
          const wikiResponse = await fetch(wikiUrl, { headers: { Accept: "application/json" } });
          if (!wikiResponse.ok) throw new Error("Minecraft Wiki returned " + wikiResponse.status);
          const wikiData = await wikiResponse.json();
          const thumbnails = new Map();
          Object.values(wikiData?.query?.pages || {}).forEach(page => {
            if (page?.title && page?.thumbnail?.source) thumbnails.set(String(page.title).replace(/\s+/g, "_").toLowerCase(), page.thumbnail.source);
          });
          (wikiData?.query?.normalized || []).forEach(item => {
            const from = String(item.from || "").replace(/\s+/g, "_").toLowerCase();
            const to = String(item.to || "").replace(/\s+/g, "_").toLowerCase();
            if (thumbnails.has(to)) thumbnails.set(from, thumbnails.get(to));
          });
          (wikiData?.query?.redirects || []).forEach(item => {
            const from = String(item.from || "").replace(/\s+/g, "_").toLowerCase();
            const to = String(item.to || "").replace(/\s+/g, "_").toLowerCase();
            if (thumbnails.has(to)) thumbnails.set(from, thumbnails.get(to));
          });
          batch.forEach((image, index) => {
            const src = thumbnails.get(requestedTitles[index].toLowerCase());
            if (src) image.src = src;
            else image.hidden = true;
          });
        } catch { batch.forEach(image => image.hidden = true); }
      }
      const postPayload = postResponse.ok ? await postResponse.json() : {posts:[]};
      const playerName = String(player.username || "").toLowerCase();
      const matchingPosts = (postPayload.posts || []).filter(post => {
        const builders = post.event?.builders || post.builders || post.authorMinecraftName || "";
        return String(Array.isArray(builders) ? builders.join(",") : builders).split(/[;,]/).some(name => name.trim().toLowerCase() === playerName);
      });
      const postsPanel = profile.querySelector('[data-profile-panel="posts"]');
      postsPanel.innerHTML = matchingPosts.length ? matchingPosts.map(post => {
        const builders = post.event?.builders || post.builders || post.authorMinecraftName || "";
        const builderText = Array.isArray(builders) ? builders.join(", ") : String(builders);
        const searchText = (post.title + " " + post.subtitle + " " + post.body + " " + builderText).toLowerCase();
        return '<article class="profile-search-row" data-profile-search="' + safeText(searchText) + '"><strong>' + safeText(post.title || "Untitled post") + '</strong><span>Builders: ' + safeText(builderText) + '</span><small>' + safeText(formatDate(post.publishedAt)) + '</small></article>';
      }).join("") + '<p class="fine-print" data-profile-empty hidden>No matching posts.</p>' : '<p class="fine-print">No published builder posts found for this player.</p>';
    } catch (error) { console.warn("Player profile supplemental data could not be loaded", error); }

    // D1 is rendered first; the plugin response replaces it without persisting live data.
    if (!liveProfile && pluginAvailable) {
      fetch(`${API_BASE}/players/${encodeURIComponent(uuid)}/live`, { cache: "no-store" })
        .then(response => response.ok ? response.json() : null)
        .then(payload => {
          const currentPath = location.pathname.replace(/\/$/, "");
          if (payload?.ok && currentPath === "/players/" + uuid) renderPlayerProfile(uuid, payload);
        })
        .catch(error => console.warn("Live player profile unavailable; keeping saved snapshot", error));
    }

  } catch {
    profile.innerHTML = `<a class="back-link" href="/players">← All players</a>${emptyPage('Player profile unavailable', 'This player could not be found or the player API is unavailable.')}`;
  }
}

function filterCommands() {
  const search = document.querySelector('#command-search')?.value.trim().toLowerCase() || '';
  const groups = [...document.querySelectorAll('[data-command-group]')];
  const count = document.querySelector('#command-count');
  const noResults = document.querySelector('#command-no-results');
  let visibleCount = 0;
  groups.forEach(group => {
    const groupMatches = !search || group.dataset.groupSearch.includes(search);
    const commands = [...group.querySelectorAll('[data-command-search]')];
    let groupVisibleCount = 0;
    commands.forEach(command => {
      const visible = groupMatches || command.dataset.commandSearch.includes(search);
      command.hidden = !visible;
      if (visible) groupVisibleCount += 1;
    });
    group.hidden = groupVisibleCount === 0;
    visibleCount += groupVisibleCount;
  });
  if (count) count.textContent = `${visibleCount} ${visibleCount === 1 ? 'command' : 'commands'}`;
  if (noResults) noResults.hidden = visibleCount > 0;
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
  const eventPeriodButton = event.target.closest('[data-event-period]');
  if (eventPeriodButton) {
    eventPeriodButton.closest('.gallery-groups').querySelectorAll('[data-event-period]').forEach(button => button.setAttribute('aria-pressed', String(button === eventPeriodButton)));
  }
  if (event.target.closest('.gallery-groups button') && !groupButton && !eventPeriodButton) {
    const buttons = [...event.target.closest('.gallery-groups').querySelectorAll('button')];
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button === event.target)));
  }
});

document.addEventListener('input', event => {
  if (event.target.matches('#player-search')) renderPlayers();
  if (event.target.matches('#command-search')) filterCommands();
});
document.addEventListener('change', event => {
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
pollPluginRefreshSignal();
// Plugin signals refresh status on start/join/leave; otherwise the website falls back to five-minute checks.
window.setInterval(pollPluginRefreshSignal, 10_000);
window.setInterval(() => { if (!pluginAvailable) fetchServerStatus(); }, 5 * 60_000);


(() => {
  const API = "https://notesmp-api.notesmp-de.workers.dev/v1";
  async function updateHeaderDiscordLink() {
    const button = document.querySelector(".header-join");
    if (!button) return;
    try {
      const response = await fetch(API + "/content/links", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      const discord = (data.links || []).find(item => item.link_key === "discord");
      const url = discord && safeWebUrl(discord.url);
      if (!url) {
        button.innerHTML = 'Join Discord <strong aria-hidden="true">↗</strong>';
        button.removeAttribute("href");
        button.removeAttribute("target");
        button.removeAttribute("rel");
        button.setAttribute("aria-disabled", "true");
        return;
      }
      button.href = url;
      button.target = "_blank";
      button.rel = "noreferrer";
      button.removeAttribute("aria-disabled");
      button.innerHTML = 'Join Discord <strong aria-hidden="true">↗</strong>';
    } catch (error) {
      console.warn("Could not load configured Discord link", error);
    }
  }
  async function updateServerLinks() {
    const section = document.querySelector("#section-server-links");
    if (!section) return;
    try {
      const response = await fetch(API + "/content/links", {cache:"no-store"});
      if (!response.ok) return;
      const data = await response.json();
      const configured = new Map((data.links || []).map(link => [String(link.link_key || "").toLowerCase(), safeUrl(link.url)]));
      section.querySelectorAll("[data-link-key]").forEach(row => {
        const url = configured.get(row.dataset.linkKey);
        if (!url || row.tagName === "A") return;
        const anchor = document.createElement("a");
        anchor.className = "resource-link";
        anchor.dataset.linkKey = row.dataset.linkKey;
        anchor.href = url;
        anchor.target = "_blank";
        anchor.rel = "noreferrer";
        anchor.innerHTML = row.innerHTML;
        const arrow = anchor.querySelector("span:last-child");
        if (arrow) { arrow.textContent = "↗"; arrow.setAttribute("aria-hidden", "true"); }
        row.replaceWith(anchor);
      });
    } catch (error) { console.warn("Could not load configured server links", error); }
  }
  updateHeaderDiscordLink();
  updateServerLinks();
  window.addEventListener("notesmp:render", updateServerLinks);
  const app = document.querySelector("#app");
  if (!app) return;
  let lastKey = "";
  let timer = null;

  function safeUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
    } catch { return ""; }
  }
  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function empty(title, message) {
    const box = element("div", "empty-state");
    box.append(element("strong", "", title), document.createTextNode(message));
    return box;
  }
  function renderDiscordMarkdown(source) {
    const fragments = [];
    const hold = html => { const token = "\uE000" + fragments.length + "\uE001"; fragments.push(html); return token; };
    const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[c]);
    let text = String(source ?? "").replace(/\r\n?/g, "\n");

    // Hold code and custom emoji outside Markdown processing.
    text = text.replace(/```([^\n]*)\n?([\s\S]*?)```/g, (_, language, code) =>
      hold('<pre><code' + (language.trim() ? ' class="language-' + escapeHtml(language.trim().replace(/[^a-zA-Z0-9_-]/g, "")) + '"' : '') + '>' + escapeHtml(code.replace(/\n$/, "")) + '</code></pre>'));
    text = text.replace(/`([^`\n]+)`/g, (_, code) => hold("<code>" + escapeHtml(code) + "</code>"));
    text = text.replace(/<(a?):([A-Za-z0-9_]+):(\d+)>/g, (_, animated, name, id) =>
      hold('<img class="discord-custom-emoji" src="https://cdn.discordapp.com/emojis/' + id + "." + (animated ? "gif" : "webp") + '?size=48&quality=lossless" alt=":' + escapeHtml(name) + ':" title=":' + escapeHtml(name) + ':" loading="lazy">'));

    text = escapeHtml(text).replace(/\\([\\*_~|>#])/g, "$1");
    text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/gi, (_, label, url) =>
      '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer">' + label + "</a>");
    text = text.replace(/\*\*(.+?)\*\*/gs, "<strong>$1</strong>")
      .replace(/__(.+?)__/gs, "<u>$1</u>").replace(/~~(.+?)~~/gs, "<del>$1</del>")
      .replace(/\*(.+?)\*/gs, "<em>$1</em>").replace(/_(.+?)_/gs, "<em>$1</em>");

    const output = [];
    let listOpen = false, quoteOpen = false;
    const closeList = () => { if (listOpen) { output.push("</ul>"); listOpen = false; } };
    const closeQuote = () => { if (quoteOpen) { output.push("</blockquote>"); quoteOpen = false; } };
    for (const line of text.split("\n")) {
      const heading = line.match(/^(#{1,6})\s+(.+)$/);
      const bullet = line.match(/^\s*[-*]\s+(.+)$/);
      const numbered = line.match(/^\s*\d+[.)]\s+(.+)$/);
      const quote = line.match(/^&gt;\s?(.*)$/);
      if (heading) { closeList(); closeQuote(); const n=heading[1].length; output.push("<h"+n+">"+heading[2]+"</h"+n+">"); }
      else if (bullet || numbered) { closeQuote(); if(!listOpen){output.push("<ul>");listOpen=true;} output.push("<li>"+(bullet?bullet[1]:numbered[1])+"</li>"); }
      else if (quote) { closeList(); if(!quoteOpen){output.push("<blockquote>");quoteOpen=true;} output.push("<p>"+quote[1]+"</p>"); }
      else { closeList(); closeQuote(); if(line.trim()) output.push("<p>"+line+"</p>"); }
    }
    closeList(); closeQuote();
    return output.join("").replace(/\uE000(\d+)\uE001/g, (_, i) => fragments[Number(i)] || "");
  }
  function resolveEventCover(post, images = []) {
    const event = post?.event || {};
    const direct = safeUrl(event.coverImage);
    if (direct) return direct;
    const rawHash = typeof event.coverHash === "string" ? event.coverHash.trim() : typeof event.coverImage === "string" ? event.coverImage.trim() : "";
    const hash = rawHash.replace(/^https?:\/\/cdn\.discordapp\.com\/guild-events\/\d+\//, "").replace(/\.(?:png|gif|webp)(?:\?.*)?$/i, "");
    const eventId = String(event.id || event.eventId || post?.discordEventId || "");
    if (hash && /^\d+$/.test(eventId)) {
      const extension = hash.startsWith("a_") ? "gif" : "png";
      return safeUrl("https://cdn.discordapp.com/guild-events/" + eventId + "/" + hash + "." + extension + "?size=1024");
    }
    return images[0] || "";
  }
  function makeCard(post) {
    const card = element("article", "post-card panel");
    const isScheduledEvent = Boolean(post.event?.scheduledStartTime);
    const images = (Array.isArray(post.images) ? post.images : []).map(safeUrl).filter(Boolean);
    // Event covers are rendered only in the dedicated event layout below;
    // keep gallery media/lightbox controls exclusive to non-event posts.
    if (!isScheduledEvent && images.length) {
      const media = element("div", "post-card-media"); const image = element("img", "post-card-image"); let active = 0;
      image.src = images[active]; image.alt = post.title || "NoteSMP gallery image"; image.loading = "lazy"; media.append(image); let counter = null;
      const show = index => { active = (index + images.length) % images.length; image.src = images[active]; if (counter) counter.textContent = (active + 1) + " / " + images.length; };
      if (images.length > 1) {
        counter = element("span", "post-image-counter", "1 / " + images.length); media.append(counter);
        const prev = element("button", "post-image-nav post-image-prev", "‹"); prev.type = "button"; prev.setAttribute("aria-label", "Previous image"); prev.addEventListener("click", event => { event.stopPropagation(); show(active - 1); });
        const next = element("button", "post-image-nav post-image-next", "›"); next.type = "button"; next.setAttribute("aria-label", "Next image"); next.addEventListener("click", event => { event.stopPropagation(); show(active + 1); }); media.append(prev, next);
        const timer = setInterval(() => show(active + 1), 4500); media.addEventListener("mouseenter", () => clearInterval(timer), { once: true });
      }
      const expand = element("button", "post-image-expand"); expand.type = "button"; expand.setAttribute("aria-label", "Open photo selection"); expand.title = "Open photo selection"; expand.textContent = "⛶"; expand.addEventListener("click", () => openImageViewer(images, image.alt, active)); media.append(expand); card.append(media);
    }
    const content = element("div", "post-card-content");
    const meta = element("div", "post-card-meta");
    meta.append(element("span", "", post.category || "update"));
    const date = post.event && post.event.scheduledStartTime ? post.event.scheduledStartTime : post.publishedAt;
    meta.append(element("span", "", date && !Number.isNaN(Date.parse(date)) ? new Date(date).toLocaleString(undefined,{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",hour12:false}) : ""));
    content.append(meta);
    const postBody = String(post.subtitle || post.body || "");
    const postTitle = String(post.title || "").trim();
    // Scheduled event title and description belong in the left column of the event layout.
    if (!isScheduledEvent) {
      const titleDuplicatesBody = postTitle && postBody.trim().startsWith(postTitle);
      const titleLooksLikeMarkdown = /^#{1,6}\\s|<a?:[A-Za-z0-9_]+:\\d+>|\\*\\*|__|~~/.test(postTitle);
      if (postTitle) content.append(element("h3", "post-card-title", postTitle));
      if (post.subtitle || post.body) { const body = element("div", "post-card-body"); body.innerHTML = renderDiscordMarkdown((post.subtitle || post.body || "").slice(0, 900)); content.append(body); }
    }
    if (isScheduledEvent) {
      const start = Date.parse(post.event.scheduledStartTime);
      const eventInfo = element("div", "scheduled-event-details");
      const details = element("div", "scheduled-event-copy");
      if (postTitle) details.append(element("h2", "scheduled-event-title", postTitle));
      if (post.subtitle || post.body) {
        const description = element("div", "post-card-body scheduled-event-description");
        description.innerHTML = renderDiscordMarkdown((post.subtitle || post.body || "").slice(0, 900));
        details.append(description);
      }
      const aside = element("div", "scheduled-event-aside");
      const cover = resolveEventCover(post, images);
      if (cover) {
        aside.style.setProperty("--event-cover-image", 'url("' + cover.replace(/["\\]/g, "") + '")');
        aside.classList.add("has-event-cover");
      }
      if (Number.isFinite(start)) {
        aside.append(element("span", "scheduled-event-start", new Date(start).toLocaleString(undefined,{weekday:"long",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"})));
        // Discord Scheduled Event status: 1 scheduled, 2 active, 3 completed, 4 cancelled.
        const eventState = getDiscordEventState(post.event);
        const countdown = element("span", "scheduled-event-countdown", "");
        const showState = (label, stateClass) => {
          countdown.textContent = label;
          countdown.classList.add("event-state-" + stateClass);
        };
        if (eventState === "cancelled") showState("Cancelled", "cancelled");
        else if (eventState === "ended") showState("Ended", "ended");
        else if (eventState === "started") showState("Started", "started");
        else {
          const updateCountdown = () => {
            const remaining = start - Date.now();
            if (remaining <= 0) { showState("Starting...", "starting"); return; }
            countdown.className = "scheduled-event-countdown";
            const days = Math.floor(remaining / 86400000);
            const hours = Math.floor((remaining % 86400000) / 3600000);
            const minutes = Math.floor((remaining % 3600000) / 60000);
            countdown.textContent = days ? "In " + days + "d " + hours + "h" : hours ? "In " + hours + "h " + minutes + "m" : "In " + minutes + "m";
          };
          updateCountdown();
          const timer = setInterval(updateCountdown, 60000);
          window.addEventListener("pagehide", () => clearInterval(timer), { once: true });
        }
        aside.append(countdown);
      }
      const channelId = String(post.event.channelId || "");
      const guildId = String(post.event.guildId || "");
      const channelName = String(post.event.channelName || "").trim();
      if (channelId && guildId && channelName) {
        const channel = element("a", "scheduled-event-place", channelName);
        channel.href = "https://discord.com/channels/" + encodeURIComponent(guildId) + "/" + encodeURIComponent(channelId);
        channel.target = "_blank";
        channel.rel = "noopener noreferrer";
        aside.append(channel);
      } else if (post.event.location) {
        aside.append(element("span", "scheduled-event-place", post.event.location));
      }
      eventInfo.append(details, aside);
      content.append(eventInfo);
    }
    const dimension = post.dimension || post.eventData?.dimension || null;
    const coords = post.coordinates || post.eventData?.coordinates || null;
    const validCoords = coords && [coords.x,coords.y,coords.z].every(value => value !== undefined && value !== null && Number.isFinite(Number(value)));
    const builderValues = post.builders || post.eventData?.builders || post.event?.builders || [];
    const builders = (Array.isArray(builderValues) ? builderValues : String(builderValues).split(","))
      .map(value => typeof value === "string" ? value.trim() : String(value?.name || value?.username || "").trim()).filter(Boolean);
    const locationText = (dimension || validCoords)
      ? [dimension, validCoords ? [coords.x,coords.y,coords.z].join("  ") : ""].filter(Boolean).join("   ")
      : "";
    if (builders.length) {
      const details = element("div", "post-card-details");
      details.append(element("span", "post-card-builders", "By " + builders.join(", ")));
      content.append(details);
    }
    if (post.event && post.event.location) content.append(element("p", "post-card-location", post.event.location));
    const footer = element("div", "post-card-footer");
    if (locationText) footer.append(element("span", "post-card-location post-card-location-coordinates", locationText));
    footer.append(element("span", "post-card-id", String(post.id ?? "")));
    content.append(footer);
    card.append(content);
    return card;
  }
  function openImageViewer(urls, alt, startIndex = 0) {
    const images = (Array.isArray(urls) ? urls : [urls]).filter(Boolean); if (!images.length) return;
    let active = Math.max(0, Math.min(startIndex, images.length - 1));
    const overlay = element("div", "image-viewer"); overlay.setAttribute("role", "dialog"); overlay.setAttribute("aria-modal", "true"); overlay.setAttribute("aria-label", "Full image view");
    const close = element("button", "image-viewer-close"); close.type = "button"; close.setAttribute("aria-label", "Close image viewer"); close.textContent = "×";
    const image = element("img", "image-viewer-image"); image.alt = alt || "Full gallery image"; const counter = element("span", "image-viewer-counter", "");
    const update = () => { image.src = images[active]; counter.textContent = (active + 1) + " / " + images.length; };
    const prev = element("button", "image-viewer-nav image-viewer-prev", "‹"); prev.type = "button"; prev.setAttribute("aria-label", "Previous photo"); prev.addEventListener("click", () => { active = (active + images.length - 1) % images.length; update(); });
    const next = element("button", "image-viewer-nav image-viewer-next", "›"); next.type = "button"; next.setAttribute("aria-label", "Next photo"); next.addEventListener("click", () => { active = (active + 1) % images.length; update(); });
    overlay.append(close, image);
    if (images.length > 1) overlay.append(prev, next, counter);
    const dismiss = () => { overlay.remove(); document.removeEventListener("keydown", onKey); }; close.addEventListener("click", dismiss); overlay.addEventListener("click", event => { if (event.target === overlay) dismiss(); });
    function onKey(event) { if (event.key === "Escape") dismiss(); else if (event.key === "ArrowLeft" && images.length > 1) { active = (active + images.length - 1) % images.length; update(); } else if (event.key === "ArrowRight" && images.length > 1) { active = (active + 1) % images.length; update(); } }
    document.addEventListener("keydown", onKey); update(); document.body.append(overlay); close.focus();
  }
  async function getPosts(category, group = "") {
    const params = new URLSearchParams({ category, limit: "100" });
    if (group) params.set("group", group.trim().toLowerCase().replace(/\s+/g, "-"));
    const response = await fetch(API + "/content/posts?" + params.toString(), { cache: "no-store" });
    if (!response.ok) throw new Error("Feed request failed");
    const data = await response.json();
    return data.posts || [];
  }
  function replaceFeed(target, posts, title, message) {
    if (!target) return;
    const old = target.querySelector(".empty-state, .post-feed");
    // Preserve the last successful feed if a refresh returns an empty list transiently.
    if (!posts.length && target.querySelector(".post-feed")) return;
    if (old) old.remove();
    if (!posts.length) {
      target.append(empty(title, message));
      return;
    }
    const feed = element("div", "post-feed");
    posts.forEach(post => feed.append(makeCard(post)));
    target.append(feed);
  }
  let newsCountdownTimer = null;
function renderNewsBanner(posts) {
  const section = document.querySelector("#home-news");
  const target = document.querySelector("#home-news-feed");
  if (!section || !target) return;
  if (newsCountdownTimer) window.clearInterval(newsCountdownTimer);
  const now = Date.now();
  const list = (Array.isArray(posts) ? posts : (posts ? [posts] : [])).filter(post => {
    const kind = String(post.event?.type || post.group || "info").toLowerCase();
    const expiry = kind === "maintenance" ? Date.parse(post.event?.expiryAt || "") : NaN;
    return !Number.isFinite(expiry) || expiry > now;
  }).sort((a,b) => Date.parse(b.publishedAt || b.updatedAt || 0) - Date.parse(a.publishedAt || a.updatedAt || 0));
  const active = [...list.filter(p => String(p.event?.type || p.group || "").toLowerCase() === "maintenance").slice(0,1),
    ...list.filter(p => ["warning","info"].includes(String(p.event?.type || p.group || "info").toLowerCase()))];
  target.replaceChildren();
  if (!active.length) { section.hidden = true; return; }
  active.forEach(post => {
    const kind = String(post.event?.type || post.group || "info").toLowerCase();
    const color = String(post.event?.color || "").toLowerCase();
    const banner = element("div", "notice-bar news-" + (["maintenance","warning","info"].includes(kind) ? kind : "info") + (kind === "warning" && ["orange","red"].includes(color) ? "-" + color : ""));
    const copy = element("div", "news-copy");
    copy.append(element("strong", "", post.title || "News"), element("span", "", post.subtitle || post.body || ""));
    banner.append(copy);
    if (post.id && kind !== "maintenance") banner.append(element("span", "notice-id", String(post.id)));
    const expiry = kind === "maintenance" ? Date.parse(post.event?.expiryAt || "") : NaN;
    if (Number.isFinite(expiry)) {
      const counter = element("div", "news-countdown");
      banner.append(counter);
      const tick = () => {
        const remaining = Math.max(0, expiry - Date.now());
        const days = Math.floor(remaining / 86400000), h = Math.floor((remaining % 86400000) / 3600000), m = Math.floor((remaining % 3600000) / 60000), sec = Math.floor((remaining % 60000) / 1000);
        counter.textContent = (days ? days + "d " : "") + h + "h " + String(m).padStart(2,"0") + "m " + String(sec).padStart(2,"0") + "s";
        if (!remaining) { window.clearInterval(newsCountdownTimer); refreshNewsBanner(); }
      };
      tick(); newsCountdownTimer = window.setInterval(tick,1000);
    }
    target.append(banner);
  });
  section.hidden = false;
}
async function refreshInfoHero() {
  const reveal = () => {
    document.querySelector("#hero-title")?.removeAttribute("hidden");
    document.querySelector("#hero-subtitle")?.removeAttribute("hidden");
  };
  try {
    const response = await fetch(API + "/content/hero", {cache:"no-store"});
    if (!response.ok) return;
    const data = await response.json();
    const title = document.querySelector("#hero-title");
    const subtitle = document.querySelector("#hero-subtitle");
    if (title && typeof data.title === "string" && data.title.trim()) title.textContent = data.title;
    if (subtitle && typeof data.subtitle === "string" && data.subtitle.trim()) subtitle.textContent = data.subtitle;
  } catch (error) { console.warn("Info hero text could not be loaded", error); }
  finally { reveal(); }
}
async function refreshNewsBanner(extra = []) {
  try {
    const response = await fetch(API + "/content/posts?category=news&limit=50", {cache:"no-store"});
    const data = response.ok ? await response.json() : {posts:[]};
    renderNewsBanner([...(data.posts || []), ...extra]);
  } catch { renderNewsBanner(extra); }
}

async function loadPage() {
    const path = location.pathname.replace(/\/$/, "") || "/";
    let key = path;
    if (path === "/gallery") {
      const active = app.querySelector("[data-gallery-group][aria-pressed='true']");
      key += ":" + (active ? active.dataset.galleryGroup : "Events");
    }
    if (key === lastKey) return;
    lastKey = key;
    try {
      if (path === "/") await refreshNewsBanner();
      if (path === "/gallery") {
        const active = app.querySelector("[data-gallery-group][aria-pressed='true']");
        const label = active ? active.dataset.galleryGroup : "Events";
        const target = app.querySelector(".page-content");
        replaceFeed(target, await getPosts("gallery", label.toLowerCase()), label + " gallery is empty", "Published Discord posts will appear here.");
      } else if (path === "/events") {
        const targetUpcoming = app.querySelector("#upcoming-events-feed");
        const targetPast = app.querySelector("#past-events-feed");
        const posts = await getPosts("events");
        const now = Date.now();
        const uniqueEvents = new Map();
        for (const post of posts) {
          const rawStart = post.event?.scheduledStartTime || post.event?.scheduled_start_time;
          const startTime = rawStart ? Date.parse(rawStart) : NaN;
          if (!Number.isFinite(startTime)) continue;
          const eventId = String(post.event?.id || post.event?.eventId || post.discordEventId || "");
          const normalizedTitle = String(post.title || "").trim().toLowerCase().replace(/\s+/g, " ");
          const identity = eventId || normalizedTitle + ":" + startTime;
          if (!uniqueEvents.has(identity)) uniqueEvents.set(identity, { post, startTime });
        }
        const events = [...uniqueEvents.values()];
        const eventStatus = post => getDiscordEventState(post.event || {});
        const upcoming = events.filter(({post}) => !["cancelled","ended"].includes(eventStatus(post))).sort((a,b) => a.startTime-b.startTime).map(({post})=>post);
        const past = events.filter(({post}) => ["cancelled","ended"].includes(eventStatus(post))).sort((a,b) => b.startTime-a.startTime).map(({post})=>post);
        replaceFeed(targetUpcoming, upcoming, "No upcoming events", "New Discord events will appear here automatically.");
        replaceFeed(targetPast, past, "No past events yet", "Completed Discord events will be collected here.");
      } else if (path === "/devlog" || path === "/rules") {
        const category = path === "/rules" ? "rules" : "updates";
        const target = app.querySelector(".page-content");
        replaceFeed(target, await getPosts(category), category === "rules" ? "Rules have not been published yet" : "No updates yet", "Publish messages from the configured Discord channel to show them here.");
      } else if (path === "/") {
        await refreshNewsBanner();
        await refreshInfoHero();
        const updatesPanel = app.querySelector("#section-server-updates");
        if (updatesPanel) {
          const updates = await getPosts("updates");
          replaceFeed(updatesPanel, updates.slice(0,1), "No updates yet", "New NoteSMP updates will appear here.");
        }
        const eventPanel = app.querySelector("#section-events .panel");
        const events = await getPosts("events");
        const statusOf = post => getDiscordEventState(post.event || {});
        const startOf = post => Date.parse(post.event?.scheduledStartTime || post.event?.scheduled_start_time || "");
        const now = Date.now();
        const upcoming = events.filter(post => Number.isFinite(startOf(post)) && startOf(post) >= now && !["cancelled","ended"].includes(statusOf(post))).sort((a,b)=>startOf(a)-startOf(b)).slice(0,2);
        if (eventPanel) {
          replaceFeed(eventPanel, upcoming, "No upcoming events", "New Discord events will appear here automatically.");
          const eventCards = eventPanel.querySelectorAll(".post-card");
          if (eventCards.length > 1) eventCards[1].classList.add("event-preview-faded");
        }
        const hero = app.querySelector("#hero-event");
        const featured = events.filter(post => Number.isFinite(startOf(post)) && !["cancelled","ended"].includes(statusOf(post)) && (statusOf(post) === "started" || (startOf(post) >= now && startOf(post) <= now + 86400000))).sort((a,b)=>startOf(a)-startOf(b))[0];
        if (hero) {
          hero.replaceChildren();
          if (featured) {
            const cover = resolveEventCover(featured, (Array.isArray(featured.images) ? featured.images : []).map(safeUrl).filter(Boolean));
            if (cover) hero.style.backgroundImage = 'linear-gradient(0deg,rgba(0,0,0,.86),rgba(0,0,0,.15)),url("' + cover.replace(/["\\]/g,"") + '")';
            const content = element("div","hero-event-content");
            const title = element("strong","hero-event-title",featured.title || "Server event");
            const desc = element("span","hero-event-subtitle",featured.subtitle || featured.body || "");
            content.append(title,desc);
            const details = element("div","hero-event-details");
            const startAt = startOf(featured);
            const state = statusOf(featured);
            if (state !== "started") {
              const countdown = element("span","hero-event-countdown","");
              const updateCountdown = () => {
                const remaining = Math.max(0,startAt-Date.now());
                if (!remaining) { countdown.textContent = "Starting now"; return; }
                const days=Math.floor(remaining/86400000),hours=Math.floor((remaining%86400000)/3600000),minutes=Math.floor((remaining%3600000)/60000),seconds=Math.floor((remaining%60000)/1000);
                countdown.textContent = "Starts in " + (days ? days+"d " : "") + hours+"h "+String(minutes).padStart(2,"0")+"m "+String(seconds).padStart(2,"0")+"s";
              };
              updateCountdown();
              const timer=setInterval(updateCountdown,1000);
              window.addEventListener("pagehide",()=>clearInterval(timer),{once:true});
              details.append(countdown);
            }
            const status = element("span","hero-event-status" + (state === "started" ? " is-in-progress" : ""),state === "started" ? "In Progress" : "Scheduled");
            details.append(status);
            const startLabel = element("span","hero-event-time",new Date(startAt).toLocaleString(undefined,{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}));
            details.append(startLabel);
            const channelId = String(featured.event?.channelId || "");
            const guildId = String(featured.event?.guildId || "");
            const channelName = String(featured.event?.channelName || featured.event?.channel || featured.event?.location || "").trim();
            if (channelName) {
              const channel = element("a","hero-event-place",channelName);
              if (channelId && guildId) channel.href = "https://discord.com/channels/" + encodeURIComponent(guildId) + "/" + encodeURIComponent(channelId);
              else channel.href = "https://discord.com";
              channel.target="\_blank"; channel.rel="noopener noreferrer";
              details.append(channel);
            }
            hero.append(content,details); hero.hidden = false;
          } else { hero.hidden = true; hero.style.backgroundImage = ""; }
        }
        const sideLists = app.querySelectorAll(".side-column .link-list");
        if (sideLists[0]) {
          const response = await fetch(API + "/content/links", { cache: "no-store" });
          const data = response.ok ? await response.json() : {links:[]};
          const links = Object.fromEntries((data.links || []).map(item => [item.link_key, item.url]));
          sideLists[0].replaceChildren();
          ["discord","youtube","modpack","bluemap"].forEach(key => {
            const url = safeWebUrl(links[key]);
            const item = url ? element("a","resource-link") : element("div","resource-link is-disabled");
            const content = element("span","resource-link-content");
            const icon = element("span","resource-link-icon"); icon.innerHTML = linkIcon(key);
            content.append(icon,element("span","",key[0].toUpperCase()+key.slice(1)));
            item.append(content,element("strong","resource-link-arrow",url ? "↗" : "Link not set"));
            if (url) { item.href=url; item.target="_blank"; item.rel="noreferrer"; } else item.setAttribute("aria-disabled","true");
            sideLists[0].append(item);
          });
        }
        const creatorList = app.querySelector("#section-creators .link-list");
        if (creatorList) {
          const response = await fetch(API + "/creators", { cache: "no-store" });
          if (!response.ok) throw new Error("Creator roster unavailable");
          const data = await response.json();
          const creators = (data.creators || []).slice().sort((a,b) => Number(/notesmp/i.test(b.live_title || "")) - Number(/notesmp/i.test(a.live_title || "")));
          creatorList.replaceChildren();
          if (!creators.length) creatorList.append(element("div","resource-link is-disabled","No creators added yet"));
          creators.forEach(item => {
            const live = Boolean(item.live), link = element("a","creator-card" + (live ? " is-live" : " is-offline"));
            link.href = safeUrl(item.live_url) || safeUrl("https://www.twitch.tv/" + item.twitch_login); link.target="_blank"; link.rel="noreferrer";
            const avatar=element("img","creator-avatar"); avatar.src=safeUrl(item.avatar_url)||"https://static-cdn.jtvnw.net/jtv_user_pictures/default-user.png"; avatar.alt=""; avatar.loading="lazy";
            const info=element("span","creator-info"); info.append(element("strong","creator-name",item.display_name||item.twitch_login)); if(live&&item.live_title)info.append(element("span","creator-stream-title",item.live_title));
            const statusLabel = live ? (/notesmp/i.test(item.live_title||"") ? "Live on NoteSMP" : "Live") : "Offline";
          const status = element("span","creator-status"+(live?" live":" offline"),statusLabel);
          if (live) status.prepend(element("span","creator-status-dot"));
          link.append(avatar,info,status); creatorList.append(link);
          });
        }
      }
    } catch (error) {
      console.error("NoteSMP content feed failed", error);
      const target = app.querySelector(".page-content");
      if (target && (path === "/events" || path === "/gallery" || path === "/devlog" || path === "/rules")) {
        const old = target.querySelector(".empty-state, .post-feed");
        if (old) old.replaceWith(empty("Content unavailable","Could not load this NoteSMP feed. Please try again later."));
      }
    }
  }
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(loadPage, 80);
  }
  new MutationObserver(schedule).observe(app,{childList:true,subtree:true});
  document.addEventListener("click", event => {
    if (event.target.closest("[data-event-period]") || event.target.closest("[data-gallery-group]")) {
      lastKey = "";
      setTimeout(loadPage,120);
    }
  });
  window.addEventListener("notesmp:render", () => { lastKey = ""; schedule(); });
  schedule();
})();

