import dotenv from 'dotenv';
import path from 'path';

// Load .env.test and override any existing process.env variables
dotenv.config({
  path: path.resolve(__dirname, '../.env.test'),
  override: true,
});

// Every integration suite deletes fixture tables. Never fall back to the app DB.
const testUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
if (!testUrl || !/^\/[a-zA-Z0-9_]+_test(?:_db)?$/.test(new URL(testUrl).pathname)) {
  throw new Error('Tests require an explicit DATABASE_URL / TEST_DATABASE_URL ending in _test or _test_db.');
}
process.env.DATABASE_URL = testUrl;
process.env.NODE_ENV = 'test';
