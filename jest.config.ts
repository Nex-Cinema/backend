import type { Config } from 'jest';
import { pathsToModuleNameMapper } from 'ts-jest';
import fs from 'fs';
import path from 'path';

// Read tsconfig.json dynamically using process.cwd() to avoid __dirname errors in ES modules
const tsconfigPath = path.resolve(process.cwd(), 'tsconfig.json');
const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
const worktreeIgnorePattern = String.raw`[/\\]\.worktrees[/\\]`;

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/tests/setup.ts'],
  testMatch: ['**/tests/**/*.test.ts'],
  testPathIgnorePatterns: [worktreeIgnorePattern],
  modulePathIgnorePatterns: [worktreeIgnorePattern],
  moduleNameMapper: pathsToModuleNameMapper(tsconfig.compilerOptions?.paths || {}, {
    prefix: '<rootDir>/',
  }),
  verbose: true,
  forceExit: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
};

export default config;
