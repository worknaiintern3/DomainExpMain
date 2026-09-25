const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://domainpulse_app:Admin%401234@127.0.0.1:5432/domainpulse_dev' });

async function run() {
  const [appsRes, domainsRes, serversRes, accountsRes] = await Promise.all([
    pool.query('SELECT * FROM website_applications ORDER BY name'),
    pool.query('SELECT * FROM domains'),
    pool.query('SELECT * FROM servers'),
    pool.query('SELECT * FROM provider_accounts'),
  ]);

  const apps = appsRes.rows;
  const domains = domainsRes.rows;
  const servers = serversRes.rows;
  const accounts = accountsRes.rows;

  const domainMap = new Map(domains.map(d => [d.id, d]));
  const domainByName = new Map(domains.map(d => [d.domain_name.toLowerCase(), d]));
  const serverMap = new Map(servers.map(s => [s.id, s]));
  const serverByIpOrHost = new Map();
  for (const s of servers) {
    if (s.primary_ip) serverByIpOrHost.set(s.primary_ip, s);
    if (s.hostname) serverByIpOrHost.set(s.hostname.toLowerCase(), s);
    serverByIpOrHost.set(s.name.toLowerCase(), s);
  }
  const accountMap = new Map(accounts.map(a => [a.id, a]));

  function resolveApp(app) {
    let matchedDomain = null;
    if (app.primary_domain_id && domainMap.has(app.primary_domain_id)) {
      matchedDomain = domainMap.get(app.primary_domain_id);
    } else if (app.primary_url) {
      try {
        const host = new URL(app.primary_url).hostname.toLowerCase().replace(/^www\./, '');
        if (domainByName.has(host)) matchedDomain = domainByName.get(host);
      } catch {}
    }

    let matchedServer = null;
    if (app.primary_url) {
      try {
        const host = new URL(app.primary_url).hostname.toLowerCase();
        if (serverByIpOrHost.has(host)) matchedServer = serverByIpOrHost.get(host);
      } catch {}
    }
    if (!matchedServer && serverByIpOrHost.has(app.name.toLowerCase())) {
      matchedServer = serverByIpOrHost.get(app.name.toLowerCase());
    }
    if (!matchedServer && app.notes) {
      for (const s of servers) {
        if (
          (s.hostname && app.notes.toLowerCase().includes(s.hostname.toLowerCase())) ||
          (s.primary_ip && app.notes.includes(s.primary_ip)) ||
          (s.name && app.notes.toLowerCase().includes(s.name.toLowerCase()))
        ) {
          matchedServer = s;
          break;
        }
      }
    }

    let matchedAccount = null;
    if (matchedServer && matchedServer.provider_account_id && accountMap.has(matchedServer.provider_account_id)) {
      matchedAccount = accountMap.get(matchedServer.provider_account_id);
    } else if (matchedDomain && matchedDomain.registrar_provider_account_id && accountMap.has(matchedDomain.registrar_provider_account_id)) {
      matchedAccount = accountMap.get(matchedDomain.registrar_provider_account_id);
    } else if (app.notes) {
      const lowerNotes = app.notes.toLowerCase();
      for (const a of accounts) {
        if (lowerNotes.includes(a.label.toLowerCase())) {
          matchedAccount = a;
          break;
        }
      }
    }

    return {
      appName: app.name,
      primaryUrl: app.primary_url,
      domain: matchedDomain?.domain_name ?? null,
      server: matchedServer?.name ?? null,
      serverIp: matchedServer?.primary_ip ?? null,
      accountLabel: matchedAccount?.label ?? 'Unassigned',
      accountProvider: matchedAccount?.provider_key ?? 'Custom',
    };
  }

  const results = apps.map(resolveApp);
  console.table(results);

  await pool.end();
}
run().catch(console.error);
