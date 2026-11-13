export function matchRoute(routes, method, pathname) {
  for (const r of routes) {
    if (r.method !== method) continue;

    if (typeof r.path === 'string') {
      if (r.path === pathname) return { route: r, params: [] };
    } else {
      const m = pathname.match(r.path);
      if (m) return { route: r, params: m.slice(1) };
    }
  }
  return null;
}