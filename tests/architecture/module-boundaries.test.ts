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

  it('does not expose removed staff capabilities', () => {
    const removedPaths = [
      path.join(modulesRoot, 'workforce'),
      path.join(modulesRoot, 'box-office'),
      path.join(modulesRoot, 'identity', 'staff-profile'),
      path.join(modulesRoot, 'reporting', 'staff'),
    ];
    const compositionSource = fs.readFileSync(
      path.join(sourceRoot, 'routes', 'index.ts'),
      'utf8',
    );

    const remainingFiles = removedPaths.flatMap((removedPath) =>
      fs.existsSync(removedPath) ? walkTypeScriptFiles(removedPath) : [],
    );

    expect(remainingFiles).toEqual([]);
    expect(compositionSource).not.toMatch(/StaffRouter|shiftAdminRouter|\/staff\//);
    expect(compositionSource).not.toContain("'/ca-lam-viec'");
  });

  it('keeps the Prisma model limited to Admin and Customer actors', () => {
    const schema = fs.readFileSync(
      path.resolve(__dirname, '../../prisma/schema.prisma'),
      'utf8',
    );
    const removedSchemaTerms = [
      'STAFF',
      'model NhanVien',
      'model CaLamViec',
      'model ChiTietCaLamViec',
      'MaNhanVien',
      'CuaSoCheckInPhut',
      'HanHuyCaTruocGio',
    ];

    for (const term of removedSchemaTerms) {
      expect(schema).not.toContain(term);
    }
    expect(schema).toMatch(/model PhieuDatVe[\s\S]*?MaKhachHang\s+String\s+@db\.VarChar\(36\)/);
    expect(schema).toMatch(/model PhieuDatVe[\s\S]*?KhachHang\s+KhachHang\s+@relation/);
    const bookingModel = schema.match(/model PhieuDatVe\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';
    const ticketDetailModel = schema.match(/model ChiTietDatVe\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';
    expect(bookingModel).toMatch(/DaCheckIn\s+Boolean\s+@default\(false\)/);
    expect(bookingModel).toMatch(/ThoiGianCheckIn\s+DateTime\?/);
    expect(ticketDetailModel).not.toContain('DaCheckIn');
    expect(ticketDetailModel).not.toContain('ThoiGianCheckIn');
  });
});
