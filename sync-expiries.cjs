const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://domainpulse_app:Admin%401234@127.0.0.1:5432/domainpulse_dev',
});

const API_KEY = 'ce2619a4ee0e49799a05b15e731ce193';

async function fetchWhoisWithRetry(domainName, retries = 3) {
  // First try Verisign RDAP if it's .com
  if (domainName.endsWith('.com')) {
    try {
      const vRes = await fetch(`https://rdap.verisign.com/com/v1/domain/${domainName}`, {
        headers: { Accept: 'application/rdap+json, application/json' },
        signal: AbortSignal.timeout(6000),
      });
      if (vRes.ok) {
        const vData = await vRes.json();
        const expEvent = vData.events?.find((e) => e.eventAction === 'expiration');
        const regEvent = vData.events?.find((e) => e.eventAction === 'registration');
        if (expEvent?.eventDate) {
          return {
            expiresAt: new Date(expEvent.eventDate),
            registeredAt: regEvent?.eventDate ? new Date(regEvent.eventDate) : null,
            registrar: 'Verisign/Registry',
          };
        }
      }
    } catch {}
  }

  // WhoisFreaks query
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const url = `https://api.whoisfreaks.com/v2.0/whois/live?apiKey=${encodeURIComponent(
        API_KEY
      )}&domainName=${encodeURIComponent(domainName)}&format=json`;
      const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
      if (!res.ok) {
        await new Promise((r) => setTimeout(r, 2000 * attempt));
        continue;
      }
      const data = await res.json();
      if (data && data.status !== false && data.expiry_date) {
        return {
          expiresAt: new Date(data.expiry_date),
          registeredAt: data.create_date ? new Date(data.create_date) : null,
          registrar: data.domain_registrar?.registrar_name || null,
        };
      }
      if (data && data.message && data.message.includes('Limit')) {
        console.log(`  [Rate limited, waiting 3s...]`);
        await new Promise((r) => setTimeout(r, 3000));
      }
    } catch (err) {
      console.warn(`  Attempt ${attempt} failed for ${domainName}: ${err.message}`);
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
  return null;
}

async function run() {
  console.log('Fetching all domains in workspace...');
  const res = await pool.query(
    `SELECT id, domain_name, expires_at FROM domains WHERE expires_at IS NULL ORDER BY domain_name`
  );

  console.log(`Found ${res.rows.length} domains missing expiry dates.`);

  for (const domain of res.rows) {
    process.stdout.write(`Fetching ${domain.domain_name}... `);
    const info = await fetchWhoisWithRetry(domain.domain_name);
    if (info && info.expiresAt) {
      await pool.query(
        `UPDATE domains SET expires_at = $1, registered_at = COALESCE($2, registered_at), updated_at = NOW() WHERE id = $3`,
        [info.expiresAt, info.registeredAt, domain.id]
      );
      console.log(`[OK] Expiry: ${info.expiresAt.toISOString().slice(0, 10)} (${info.registrar || 'WHOIS'})`);
    } else {
      console.log(`[FAILED]`);
    }
    await new Promise((r) => setTimeout(r, 1200));
  }

  // Also update website applications with SSL probe / domain links
  console.log('Updating website applications with domain links...');
  await pool.query(`
    UPDATE website_applications wa
    SET primary_domain_id = d.id
    FROM domains d
    WHERE wa.workspace_id = d.workspace_id
      AND (
        wa.primary_url ILIKE '%' || d.domain_name || '%'
        OR wa.name ILIKE '%' || d.domain_name || '%'
      )
      AND wa.primary_domain_id IS NULL;
  `);

  console.log('Done!');
  await pool.end();
}

run().catch((err) => {
  console.error(err);
  pool.end();
});
