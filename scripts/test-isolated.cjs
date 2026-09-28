// Local verification only: creates a dedicated schema, never resets the app DB.
const { spawnSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { PrismaClient } = require('@prisma/client');
const dotenv = require('dotenv');

async function main() {
  const local = dotenv.parse(readFileSync('.env'));
  const url = new URL(local.DATABASE_URL);
  if (!['localhost', '127.0.0.1'].includes(url.hostname)) {
    throw new Error('Isolated test runner only supports a local MySQL instance.');
  }
  const database = 'nex_cinema_admin_test';
  url.pathname = '/mysql';
  const admin = new PrismaClient({ datasources: { db: { url: url.toString() } } });
  try {
    await admin.$executeRawUnsafe(`CREATE DATABASE IF NOT EXISTS ${database} CHARACTER SET utf8mb4`);
  } finally {
    await admin.$disconnect();
  }
  url.pathname = `/${database}`;
  const env = {
    ...process.env,
    DATABASE_URL: url.toString(),
    TEST_DATABASE_URL: url.toString(),
    NODE_ENV: 'test',
    ACCESS_TOKEN_SECRET: 'isolated-test-access-secret-not-for-production',
    REFRESH_TOKEN_SECRET: 'isolated-test-refresh-secret-not-for-production',
    BCRYPT_SALT_ROUNDS: '4',
    PAYOS_CLIENT_ID: 'test-client',
    PAYOS_API_KEY: 'test-api-key',
    PAYOS_CHECKSUM_KEY: 'test-checksum-key',
  };
  const run = (args) => {
    const result = spawnSync(process.execPath, args, { env, stdio: 'inherit' });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status || 1);
  };
  run(['node_modules/prisma/build/index.js', 'db', 'push', '--skip-generate']);
  run(['node_modules/jest/bin/jest.js', '--runInBand', ...process.argv.slice(2)]);
}

main().catch(() => {
  console.error('Isolated verification failed; check local MySQL connectivity and permissions. Credentials were not logged.');
  process.exitCode = 1;
});
