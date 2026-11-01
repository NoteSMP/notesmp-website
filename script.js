const API_BASE = 'https://notesmp-api.notesmp-de.workers.dev/v1';
const SERVER_ADDRESS = 'NoteSMP.de';
const app = document.querySelector('#app');
const nav = document.querySelector('.portal-nav');
const menuButton = document.querySelector('.nav-toggle');
const toast = document.querySelector('.toast');
const routeTitles = { '/': 'Info', '/events': 'Events', '/gallery': 'Gallery', '/players': 'Players', '/commands': 'Commands', '/rules': 'Rules', '/devlog': 'Updates' };
let serverData = null;
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
  if (!url) return `<div class="resource-link is-disabled" aria-disabled="true"><span>${safeText(label)}</span><span>${safeText(hint)}</span></div>`;
  return `<a class="resource-link" href="${safeText(url)}" target="_blank" rel="noreferrer"><span>${safeText(label)}</span><span aria-hidden="true">↗</span></a>`;
}

function homePage() {
  const onlineNames = (serverData?.onlinePlayers || []).map(player => safeText(typeof player === 'string' ? player : player.name || player.username)).filter(Boolean);
  return `<div class="page-shell"><section class="home-hero" aria-labelledby="home-title"><div class="home-hero-content"><span class="eyebrow">NOTE SMP · JAVA EDITION 26.3</span><h1 id="home-title">Your world.<br>Your people.</h1><p>Everything happening on NoteSMP, in one place. Check the server, find your next event, and see what the community is building.</p><div class="hero-buttons"><a class="button-primary" href="/players">Explore players <span aria-hidden="true">→</span></a><a class="button-secondary" href="/events">See events <span aria-hidden="true">↗</span></a></div></div></section><div class="home-layout"><div class="main-column">${serverStatusMarkup()}<section class="panel"><div class="panel-heading"><div><span class="overline">SERVER UPDATES</span><h2>Announcements</h2></div><a class="text-link" href="/devlog">All updates ↗</a></div><div class="empty-state"><strong>Announcement feed not connected yet</strong>Critical maintenance alerts and server news will appear here once connected.</div></section><section><div class="home-section-heading"><div><span class="overline">COMMUNITY CALENDAR</span><h2>Upcoming events</h2></div><a class="text-link" href="/events">View all ↗</a></div><div class="panel"><div class="empty-state"><strong>Events are on the way</strong>Upcoming and past events will appear here when the Discord event feed is connected.</div></div></section></div><aside class="side-column"><section class="panel"><div class="panel-heading"><div><span class="overline">SERVER LINKS</span><h2>Find your way in</h2></div></div><div class="link-list">${resourceLink('Discord', null, 'Invite not set')}${resourceLink('YouTube', null, 'Link not set')}${resourceLink('Modpack', null, 'Link not set')}${resourceLink('BlueMap', null, 'Link not set')}</div></section><section class="panel"><div class="panel-heading"><div><span class="overline">ONLINE NOW</span><h2>Players in the world</h2></div><a class="text-link" href="/players">Players ↗</a></div><div class="empty-state" id="online-players">${onlineNames.length ? onlineNames.join(', ') : 'Live player names will show here when the server reports them.'}</div></section><section class="panel"><div class="panel-heading"><div><span class="overline">COMMUNITY</span><h2>Creators</h2></div></div><div class="link-list"><div class="resource-link is-disabled" aria-disabled="true"><span>Creator roster</span><span>Coming soon</span></div><div class="resource-link is-disabled" aria-disabled="true"><span>Live streams</span><span>Coming soon</span></div></div></aside></div></div>`;
}

function pageHeading(title, description, eyebrow) {
  return `<header class="page-heading"><div><span class="overline">${safeText(eyebrow)}</span><h1>${safeText(title)}</h1><p>${safeText(description)}</p></div></header>`;
}

function emptyPage(title, message) {
  return `<div class="panel"><div class="empty-state"><strong>${safeText(title)}</strong>${safeText(message)}</div></div>`;
}

function eventsPage() {
  return `<div class="page-shell">${pageHeading('Events', 'Upcoming plans and moments from the NoteSMP community, with past events kept close by.', 'COMMUNITY CALENDAR')}<div class="page-content"><div class="gallery-groups" aria-label="Event time period"><button class="gallery-group" type="button" data-event-period="upcoming" aria-pressed="true">Upcoming</button><button class="gallery-group" type="button" data-event-period="past" aria-pressed="false">Past Events</button></div>${emptyPage('Event feed not connected yet', 'Events will be synced from the NoteSMP Discord bot. Events with photos will link directly to their gallery collection.')}</div></div>`;
}

function galleryPage() {
  const groups = ['Events', 'Buildings', 'Places', 'In Progress'];
  return `<div class="page-shell">${pageHeading('Gallery', 'A growing archive of builds, places, and shared server moments.', 'FROM THE WORLD')}<div class="page-content"><div class="gallery-groups" aria-label="Gallery categories">${groups.map(group => `<button class="gallery-group" type="button" data-gallery-group="${group}" aria-pressed="${selectedGalleryGroup === group}">${group}</button>`).join('')}</div>${emptyPage(`${selectedGalleryGroup} gallery is empty`, 'Gallery entries and in-progress projects will appear here after the NoteSMP bot publishes Discord posts.')}</div></div>`;
}

function playerListPage() {
  return `<div class="page-shell">${pageHeading('Players', 'Search the player directory and compare the stats recorded by the server.', 'PLAYER DIRECTORY')}<div class="page-content"><div class="toolbar"><input class="search-input" id="player-search" type="search" placeholder="Search players…" aria-label="Search players"><select class="sort-select" id="player-sort" aria-label="Sort players"><option value="playtime_seconds">Most playtime</option><option value="blocks_placed">Blocks placed</option><option value="blocks_broken">Blocks broken</option><option value="kills">Kills</option><option value="deaths">Deaths</option></select><span class="player-count" id="player-count">Loading player list…</span></div><div id="player-results">${emptyPage('Loading players', 'Connecting to the NoteSMP player API…')}</div><p class="fine-print">Player records include playtime, blocks placed and broken, kills, deaths, and join activity. The current public API returns up to 100 players.</p></div></div>`;
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
  updateHeaderDiscordLink();
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
  function makeCard(post) {
    const card = element("article", "post-card panel");
    const images = (Array.isArray(post.images) ? post.images : []).map(safeUrl).filter(Boolean);
    if (images.length) {
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
    const isScheduledEvent = Boolean(post.event?.scheduledStartTime);
    const meta = element("div", "post-card-meta");
    meta.append(element("span", "", post.category || "update"));
    const date = post.event && post.event.scheduledStartTime ? post.event.scheduledStartTime : post.publishedAt;
    meta.append(element("span", "", date && !Number.isNaN(Date.parse(date)) ? new Date(date).toLocaleString(undefined,{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",hour12:false}) : ""));
    content.append(meta);
    const postBody = String(post.subtitle || post.body || "");
    const postTitle = String(post.title || "").trim();
    // Scheduled-event titles are presented as a proper heading, not body-sized text.
    if (isScheduledEvent && postTitle) content.append(element("h2", "scheduled-event-title", postTitle));
    else {
      const titleDuplicatesBody = postTitle && postBody.trim().startsWith(postTitle);
      const titleLooksLikeMarkdown = /^#{1,6}\\s|<a?:[A-Za-z0-9_]+:\\d+>|\\*\\*|__|~~/.test(postTitle);
      if (postTitle && !titleDuplicatesBody && !titleLooksLikeMarkdown) content.append(element("h3", "", postTitle));
    }
    if (post.subtitle || post.body) { const body = element("div", "post-card-body"); body.innerHTML = renderDiscordMarkdown((post.subtitle || post.body || "").slice(0, 900)); content.append(body); }
    if (isScheduledEvent) {
      const start = Date.parse(post.event.scheduledStartTime);
      const eventInfo = element("div", "scheduled-event-details");
      const details = element("div", "scheduled-event-copy");
      const aside = element("div", "scheduled-event-aside");
      const cover = safeUrl(post.event.coverImage) || images[0] || "";
      if (cover) {
        aside.style.backgroundImage = 'linear-gradient(90deg, rgba(8,14,10,.28), rgba(8,14,10,.82)), url("' + cover.replace(/["\\]/g, "") + '")';
        aside.classList.add("has-event-cover");
      }
      if (Number.isFinite(start)) {
        details.append(element("span", "scheduled-event-start", "Starts " + new Date(start).toLocaleString(undefined,{weekday:"short",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"})));
        const countdown = element("span", "scheduled-event-countdown", "");
        const updateCountdown = () => {
          const remaining = start - Date.now();
          if (remaining <= 0) { countdown.textContent = "Starting now"; return; }
          const days = Math.floor(remaining / 86400000);
          const hours = Math.floor((remaining % 86400000) / 3600000);
          const minutes = Math.floor((remaining % 3600000) / 60000);
          countdown.textContent = days ? "In " + days + "d " + hours + "h" : hours ? "In " + hours + "h " + minutes + "m" : "In " + minutes + "m";
        };
        updateCountdown();
        aside.append(countdown);
        const timer = setInterval(updateCountdown, 60000);
        window.addEventListener("pagehide", () => clearInterval(timer), { once: true });
      }
      const channelId = String(post.event.channelId || "");
      const guildId = String(post.event.guildId || "");
      const channelName = String(post.event.channelName || "").trim();
      if (channelId && guildId && channelName) {
        const channel = element("a", "scheduled-event-place", channelName);
        channel.href = "https://discord.com/channels/" + encodeURIComponent(guildId) + "/" + encodeURIComponent(channelId);
        channel.target = "_blank";
        channel.rel = "noopener noreferrer";
        details.append(channel);
      } else if (post.event.location) {
        details.append(element("span", "scheduled-event-place", post.event.location));
      }
      eventInfo.append(details, aside);
      content.append(eventInfo);
    }
    const dimension = post.dimension || post.eventData?.dimension || null;
    const coords = post.coordinates || post.eventData?.coordinates || null;
    if (dimension || coords) {
      const location = element("div", "post-card-location");
      if (dimension) location.append(element("span", "post-dimension", dimension));
      if (coords && [coords.x,coords.y,coords.z].every(value => value !== undefined && value !== null && Number.isFinite(Number(value)))) {
        location.append(element("span", "post-coordinates", coords.x + " " + coords.y + " " + coords.z));
      }
      content.append(location);
    }
    if (post.event && post.event.location) content.append(element("p", "post-card-location", post.event.location));
    const footer = element("div", "post-card-footer");
    footer.append(element("span", "", "POST ID · " + post.id));
    if (post.authorMinecraftName) footer.append(element("span", "", "By " + post.authorMinecraftName));
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
    overlay.append(close, prev, image, next); if (images.length > 1) overlay.append(counter);
    const dismiss = () => { overlay.remove(); document.removeEventListener("keydown", onKey); }; close.addEventListener("click", dismiss); overlay.addEventListener("click", event => { if (event.target === overlay) dismiss(); });
    function onKey(event) { if (event.key === "Escape") dismiss(); else if (event.key === "ArrowLeft" && images.length > 1) { active = (active + images.length - 1) % images.length; update(); } else if (event.key === "ArrowRight" && images.length > 1) { active = (active + 1) % images.length; update(); } }
    document.addEventListener("keydown", onKey); update(); document.body.append(overlay); close.focus();
  }
  async function getPosts(category, group = "") {
    const params = new URLSearchParams({ category, limit: "100" });
    if (group) params.set("group", group);
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
  async function loadPage() {
    const path = location.pathname.replace(/\/$/, "") || "/";
    let key = path;
    if (path === "/gallery") {
      const active = app.querySelector("[data-gallery-group][aria-pressed='true']");
      key += ":" + (active ? active.dataset.galleryGroup : "Events");
    }
    if (path === "/events") {
      const active = app.querySelector("[data-event-period][aria-pressed='true']");
      key += ":" + (active ? active.dataset.eventPeriod : "upcoming");
    }
    if (key === lastKey) return;
    lastKey = key;
    try {
      if (path === "/gallery") {
        const active = app.querySelector("[data-gallery-group][aria-pressed='true']");
        const label = active ? active.dataset.galleryGroup : "Events";
        const target = app.querySelector(".page-content");
        replaceFeed(target, await getPosts("gallery", label.toLowerCase()), label + " gallery is empty", "Published Discord posts will appear here.");
      } else if (path === "/events") {
        const active = app.querySelector("[data-event-period][aria-pressed='true']");
        const period = active ? active.dataset.eventPeriod : "upcoming";
        const target = app.querySelector(".page-content");
        const posts = await getPosts("events");
        const now = Date.now();
        // Classify only by the event's scheduled start. This makes Upcoming and Past
        // mutually exclusive, and keeps old synced rows in Past after Discord deletes them.
        // Deduplicate the complete feed before splitting into time periods.
        // This prevents stale duplicate rows from appearing in both groups.
        const uniqueEvents = new Map();
        for (const post of posts) {
          const rawStart = post.event?.scheduledStartTime || post.event?.scheduled_start_time;
          const startTime = rawStart ? Date.parse(rawStart) : NaN;
          if (!Number.isFinite(startTime)) continue;
          // Database rows can have distinct post IDs for the same Discord event.
          // Event title + exact scheduled timestamp is the stable identity for grouping.
          const normalizedTitle = String(post.title || "").trim().toLowerCase().replace(/\\s+/g, " ");
          const key = normalizedTitle + ":" + startTime;
          if (!uniqueEvents.has(key)) uniqueEvents.set(key, { post, startTime });
        }
        const filtered = [...uniqueEvents.values()]
          .filter(({ startTime }) => period === "past" ? startTime < now : startTime >= now)
          .map(({ post }) => post);
        replaceFeed(target, filtered, "No events in this period", "New Discord events will appear here automatically.");
      } else if (path === "/devlog" || path === "/rules") {
        const category = path === "/rules" ? "rules" : "updates";
        const target = app.querySelector(".page-content");
        replaceFeed(target, await getPosts(category), category === "rules" ? "Rules have not been published yet" : "No updates yet", "Publish messages from the configured Discord channel to show them here.");
      } else if (path === "/") {
        const panels = app.querySelectorAll(".main-column .panel");
        if (panels[1]) replaceFeed(panels[1], await getPosts("updates").then(items => items.slice(0,3)), "No announcements yet", "New NoteSMP announcements will appear here.");
        const eventHeading = app.querySelector(".home-section-heading");
        const eventPanel = eventHeading?.nextElementSibling;
        if (eventPanel?.classList.contains("panel")) {
          const events = await getPosts("events");
          replaceFeed(eventPanel, events.filter(post => post.event?.scheduledStartTime && Date.parse(post.event.scheduledStartTime) >= Date.now()).slice(0,3), "No upcoming events", "New Discord events will appear here automatically.");
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
        if (sideLists[1]) {
          const response = await fetch(API + "/creators", { cache: "no-store" });
          if (!response.ok) throw new Error("Creator roster unavailable");
          const data = await response.json();
          const creators = (data.creators || []).slice().sort((a,b) => Number(Boolean(b.live)) - Number(Boolean(a.live)) || String(a.twitch_login).localeCompare(String(b.twitch_login)));
          // Do not replace a populated roster with a transient empty response.
          if (!creators.length && sideLists[1].querySelector(".creator-card")) {
            console.warn("Creator API returned an empty roster; keeping the currently displayed creators.");
          } else {
            sideLists[1].replaceChildren();
            if (!creators.length) sideLists[1].append(element("div","resource-link is-disabled","No creators added yet"));
          }
          if (creators.length) creators.forEach(item => {
            const isLive = Boolean(item.live);
            const link = element("a", "creator-card" + (isLive ? " is-live" : " is-offline"));
            const twitchUrl = safeUrl(item.live_url) || safeUrl("https://www.twitch.tv/" + item.twitch_login);
            link.href = twitchUrl; link.target = "_blank"; link.rel = "noreferrer";
            const avatar = element("img", "creator-avatar");
            avatar.src = safeUrl(item.avatar_url) || "https://static-cdn.jtvnw.net/jtv_user_pictures/default-user.png";
            avatar.alt = "";
            avatar.loading = "lazy";
            avatar.onerror = () => { avatar.onerror = null; avatar.removeAttribute("src"); avatar.classList.add("avatar-unavailable"); };
            const info = element("span", "creator-info");
            info.append(element("strong", "creator-name", item.twitch_login));
            if (isLive && item.live_title) info.append(element("span", "creator-stream-title", item.live_title));
            const badge = element("span", "creator-status" + (isLive ? " live" : " offline"), isLive ? (/notesmp/i.test(item.live_title || "") ? "Live on NoteSMP" : "Live") : "Offline");
            link.append(avatar, info, badge);
            sideLists[1].append(link);
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

