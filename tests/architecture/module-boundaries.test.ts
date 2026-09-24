import fs from 'fs';
import path from 'path';

const sourceRoot = path.resolve(__dirname, '../../src');
const modulesRoot = path.join(sourceRoot, 'modules');

const walkTypeScriptFiles = (directory: string): string[] =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return walkTypeScriptFiles(fullPath);
    return entry.isFile() && entry.name.endsWith('.ts') ? [fullPath] : [];
  });

const importsFrom = (filePath: string): string[] => {
  const content = fs.readFileSync(filePath, 'utf8');
  return [...content.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((match) => match[1]);
};

describe('feature architecture boundaries', () => {
  it('allows cross-capability imports only through the target index', () => {
    const violations: string[] = [];

    for (const filePath of walkTypeScriptFiles(modulesRoot)) {
      const sourceCapability = path.relative(modulesRoot, filePath).split(path.sep)[0];
      for (const importPath of importsFrom(filePath).filter((value) => value.startsWith('.'))) {
        const resolved = path.resolve(path.dirname(filePath), importPath);
        const relativeTarget = path.relative(modulesRoot, resolved);
        if (relativeTarget.startsWith('..')) continue;

        const targetCapability = relativeTarget.split(path.sep)[0];
        if (sourceCapability === targetCapability) continue;

        const publicBoundary = path.join(modulesRoot, targetCapability);
        if (resolved !== publicBoundary && resolved !== path.join(publicBoundary, 'index')) {
          violations.push(
            `${path.relative(sourceRoot, filePath)} -> ${importPath}`,
          );
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('keeps shared code independent from feature modules', () => {
    const sharedRoot = path.join(sourceRoot, 'shared');
    const violations = walkTypeScriptFiles(sharedRoot).flatMap((filePath) =>
      importsFrom(filePath)
        .filter((importPath) => importPath.includes('/modules/'))
        .map((importPath) => `${path.relative(sourceRoot, filePath)} -> ${importPath}`),
    );

    expect(violations).toEqual([]);
  });

  it('requires composition code to import capability roots', () => {
    const compositionFiles = [
      path.join(sourceRoot, 'routes', 'index.ts'),
      path.join(sourceRoot, 'server.ts'),
      path.join(sourceRoot, 'jobs', 'releaseExpiredSeatHolds.job.ts'),
    ];
    const violations = compositionFiles.flatMap((filePath) =>
      importsFrom(filePath)
        .filter((importPath) => importPath.includes('/modules/'))
        .filter((importPath) => importPath.split('/modules/')[1].includes('/'))
        .map((importPath) => `${path.relative(sourceRoot, filePath)} -> ${importPath}`),
    );

    expect(violations).toEqual([]);
  });
});
