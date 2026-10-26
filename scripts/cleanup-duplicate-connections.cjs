const { MongoClient } = require('mongodb');
require('dotenv').config({ path: 'apps/api/.env' });

async function deduplicate() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db(process.env.MONGODB_DB_NAME || 'domainpulse');

  // 1. Find all active connections sorted newest first
  const conns = await db
    .collection('providerConnections')
    .find({ connectionStatus: 'CONNECTED' })
    .sort({ createdAt: -1 })
    .toArray();
  console.log('Active connections before cleanup:', conns.length);

  const keep = new Map();
  const toDelete = [];

  for (const c of conns) {
    // Unique key: workspaceId + providerAccountId
    const key = `${c.workspaceId}:${c.providerAccountId}`;
    if (!keep.has(key)) {
      keep.set(key, c.id);
    } else {
      toDelete.push(c.id);
    }
  }

  console.log('Connections to keep:', keep.size);
  console.log('Duplicate connections to delete:', toDelete.length);

  if (toDelete.length > 0) {
    const res = await db.collection('providerConnections').deleteMany({
      id: { $in: toDelete },
    });
    console.log('Deleted duplicate connections:', res.deletedCount);
  }

  // Also check duplicate accounts with exact same label and providerKey in the same workspace
  const accounts = await db
    .collection('providerAccounts')
    .find({})
    .sort({ createdAt: -1 })
    .toArray();
  const keepAcc = new Map();
  const toDeleteAcc = [];

  for (const acc of accounts) {
    const key = `${acc.workspaceId}:${acc.providerKey}:${(acc.label || '').trim().toLowerCase()}`;
    if (!keepAcc.has(key)) {
      keepAcc.set(key, acc.id);
    } else {
      // Only delete if it has no active connections
      const activeConn = await db.collection('providerConnections').findOne({
        providerAccountId: acc.id,
        connectionStatus: 'CONNECTED',
      });
      if (!activeConn) {
        toDeleteAcc.push(acc.id);
      }
    }
  }

  if (toDeleteAcc.length > 0) {
    const resAcc = await db.collection('providerAccounts').deleteMany({
      id: { $in: toDeleteAcc },
    });
    console.log('Deleted duplicate empty provider accounts:', resAcc.deletedCount);
  }

  const remaining = await db
    .collection('providerConnections')
    .find({ connectionStatus: 'CONNECTED' })
    .toArray();
  console.log('Active connections after cleanup:', remaining.length);

  await client.close();
}

deduplicate().catch(console.error);
