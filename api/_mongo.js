const { MongoClient } = require('mongodb');

let client;
let db;

async function getDb() {
  if (db) return db;
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI not configured');
  if (!client) {
    client = new MongoClient(uri, { maxPoolSize: 10 });
    await client.connect();
  }
  db = client.db(process.env.MONGODB_DB || 'app');
  return db;
}

module.exports = { getDb };