/* One page view per document; no query/hash, cookies, localStorage or UV tracking. */
(() => {
  const {protocol, hostname, pathname} = window.location;
  if (!/^https?:$/.test(protocol) || !['bunnychen.top', 'www.bunnychen.top'].includes(hostname)) return;
  if (!/^\/BunnyChen-DailyCost(?:\/|$)/.test(pathname) || window.__dailyCostPageCounted) return;
  window.__dailyCostPageCounted = true;
  fetch('https://events.vercount.one/api/v2/log', {
    method: 'POST',
    keepalive: true,
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({url: 'https://bunnychen.top' + pathname, isNewUv: false}),
  }).catch(() => {});
})();
