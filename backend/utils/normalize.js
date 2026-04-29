export function normalize(raw) {
  try {
    const u = new URL(raw);

    const hostname = u.hostname.toLowerCase();
    const port = u.port ? `:${u.port}` : "";
    const pathname = u.pathname.replace(/\/$/, "");
    const search = u.search || "";

    return {
      full: hostname + port + pathname + search,
      domain: hostname,
    };
  } catch {
    return null;
  }
}