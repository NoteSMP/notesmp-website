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