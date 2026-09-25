require('dotenv').config();
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect().then(async () => {
  // Check inventory_nodes schema
  const schema = await client.query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'inventory_nodes' ORDER BY ordinal_position
  `);
  console.log('inventory_nodes columns:', schema.rows.map(r => r.column_name).join(', '));

  // Check provider_resource_links schema
  const schema2 = await client.query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'provider_resource_links' ORDER BY ordinal_position
  `);
  console.log('provider_resource_links columns:', schema2.rows.map(r => r.column_name).join(', '));

  // Check servers and their provider account links
  const servers = await client.query(`
    SELECT s.id, s.name, s.primary_ip, s.hostname, s.provider_account_id, pa.label, pa.provider_key
    FROM servers s
    LEFT JOIN provider_accounts pa ON pa.id = s.provider_account_id
    ORDER BY pa.label
  `);
  console.log('\n=== Servers ===');
  for (const row of servers.rows) {
    console.log(row.label || 'NO ACCOUNT', '|', row.name, '|', row.primary_ip, '|', row.hostname);
  }

  // Check apps with NONE that might be linked to servers via URL/IP
  const appsNone = await client.query(`
    SELECT wa.name, wa.primary_url, wa.primary_domain_id, wa.notes
    FROM website_applications wa
    LEFT JOIN domains d ON d.id = wa.primary_domain_id
    WHERE d.registrar_provider_account_id IS NULL
    ORDER BY wa.name
  `);
  console.log('\n=== Unlinked Apps ===');
  for (const row of appsNone.rows) {
    console.log(row.name, '|', row.primary_url, '|', row.notes ? row.notes.substring(0, 60) : '');
  }

  await client.end();
}).catch(e => console.error(e.message));
