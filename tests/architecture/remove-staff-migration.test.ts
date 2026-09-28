import fs from 'fs';
import path from 'path';

const migrationPath = path.resolve(
  __dirname,
  '../../prisma/migrations/20260928120000_remove_staff_scope/migration.sql',
);

describe('remove Staff migration', () => {
  it('cleans dependent data before narrowing the schema', () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
    const sql = fs.readFileSync(migrationPath, 'utf8');
    const position = (statement: string) => {
      const index = sql.indexOf(statement);
      expect(index).toBeGreaterThanOrEqual(0);
      return index;
    };

    const refunds = position('DELETE refund_rows');
    const transactions = position('DELETE transaction_rows');
    const ticketDetails = position('DELETE ticket_rows');
    const bookings = position('DELETE booking_rows');
    expect(refunds).toBeLessThan(transactions);
    expect(transactions).toBeLessThan(ticketDetails);
    expect(ticketDetails).toBeLessThan(bookings);

    const heldSeats = position('UPDATE `ghe_suat_chieu` held_seats');
    const refreshTokens = position('DELETE refresh_tokens');
    const resetOtps = position('DELETE reset_otps');
    const staffAccounts = position('DELETE staff_accounts');
    const narrowRole = position("MODIFY `VaiTro` ENUM('ADMIN', 'CUSTOMER')");
    expect(heldSeats).toBeLessThan(staffAccounts);
    expect(refreshTokens).toBeLessThan(staffAccounts);
    expect(resetOtps).toBeLessThan(staffAccounts);
    expect(staffAccounts).toBeLessThan(narrowRole);

    expect(sql).toContain('DROP TABLE `chi_tiet_ca_lam_viec`');
    expect(sql).toContain('DROP TABLE `ca_lam_viec`');
    expect(sql).toContain('DROP TABLE `nhan_vien`');
    expect(sql).toContain('DROP COLUMN `DaCheckIn`');
    expect(sql).toContain('DROP COLUMN `ThoiGianCheckIn`');
    expect(sql).toContain('DROP COLUMN `CuaSoCheckInPhut`');
    expect(sql).toContain('DROP COLUMN `HanHuyCaTruocGio`');
  });
});
