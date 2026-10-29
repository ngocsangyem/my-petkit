// Runs in <head> before the first paint so a reload never flashes the wrong
// mode. An external file because the CSP forbids inline scripts. The choice
// ("system", "light" or "dark") is written by usePersistedState('theme') as JSON
// under `mp.theme` (src/shared/ui/theme-mode.tsx).
(function () {
  var choice = 'system';
  try {
    choice = JSON.parse(localStorage.getItem('mp.theme') || '"system"');
  } catch (e) {
    // Storage blocked or unreadable: follow the system.
  }
  var dark =
    choice === 'dark' ||
    (choice !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
})();
