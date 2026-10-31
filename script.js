const menuButton = document.querySelector('.menu-toggle');
const nav = document.querySelector('.nav-links');
menuButton?.addEventListener('click', () => {
  const isOpen = nav.classList.toggle('open');
  menuButton.setAttribute('aria-expanded', String(isOpen));
});
nav?.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
  nav.classList.remove('open');
  menuButton?.setAttribute('aria-expanded', 'false');
}));
document.querySelector('#year').textContent = new Date().getFullYear();
const copyButton = document.querySelector('#copy-address');
const toast = document.querySelector('.toast');
copyButton?.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText('notesmp.de');
    toast.textContent = 'Server address copied!';
    toast.classList.add('show');
    window.setTimeout(() => toast.classList.remove('show'), 2200);
  } catch {
    toast.textContent = 'Copy notesmp.de to join the server';
    toast.classList.add('show');
    window.setTimeout(() => toast.classList.remove('show'), 2200);
  }
});

// Public Minecraft status. The provider caches responses, so displayed values
// may be up to five minutes old even though this page checks periodically.
const statusTitle = document.querySelector('#status-title');
const statusDetail = document.querySelector('#status-detail');
const statusDot = document.querySelector('#status-dot');
const statusBox = document.querySelector('#server-status');
const statusMotd = document.querySelector('#server-motd');
const statusEndpoint = 'https://notesmp-api.notesmp-de.workers.dev/v1/server';

async function refreshServerStatus() {
  if (!statusTitle || !statusDetail || !statusDot) return;
  try {
    const response = await fetch(statusEndpoint, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('Status service unavailable');
    const data = await response.json();

    if (data.online) {
      const online = Number(data.players?.online ?? 0);
      const max = Number(data.players?.max ?? 0);
      statusTitle.textContent = 'ONLINE · ' + online + (max ? '/' + max : '') + ' PLAYERS';
      const motdLines = data.motd?.clean;
      const motdText = Array.isArray(motdLines) ? motdLines.join(' ').trim() : (typeof motdLines === 'string' ? motdLines.trim() : '');
      if (statusMotd) statusMotd.textContent = motdText || 'No server MOTD configured';
      const version = data.version ? ' · ' + data.version : '';
      statusDetail.textContent = 'Java server' + version + ' · Auto-updating';
      statusDot.classList.add('is-online');
      statusDot.classList.remove('is-offline');
      statusBox?.classList.add('is-online');
      statusBox?.classList.remove('is-offline');
    } else {
      if (statusMotd) statusMotd.textContent = 'Server message unavailable while offline';
      statusTitle.textContent = 'CURRENTLY OFFLINE';
      statusDetail.textContent = 'The server is not responding right now';
      statusDot.classList.add('is-offline');
      statusDot.classList.remove('is-online');
      statusBox?.classList.add('is-offline');
      statusBox?.classList.remove('is-online');
    }
  } catch {
    if (statusMotd) statusMotd.textContent = 'MOTD unavailable right now';
    statusTitle.textContent = 'STATUS UNAVAILABLE';
    statusDetail.textContent = 'Could not reach the status service · Try again soon';
    statusDot.classList.remove('is-online', 'is-offline');
    statusBox?.classList.remove('is-online', 'is-offline');
  }
}

refreshServerStatus();
window.setInterval(refreshServerStatus, 60_000);
