-- Capture seats belonging to legacy counter-sale bookings before deleting them.
CREATE TEMPORARY TABLE `_removed_booking_seats` (
    `MaGheSuatChieu` VARCHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL,
    PRIMARY KEY (`MaGheSuatChieu`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT IGNORE INTO `_removed_booking_seats` (`MaGheSuatChieu`)
SELECT ticket_rows.`MaGheSuatChieu`
FROM `chi_tiet_dat_ve` ticket_rows
INNER JOIN `phieu_dat_ve` booking_rows
    ON booking_rows.`MaPhieuDat` = ticket_rows.`MaPhieuDat`
WHERE booking_rows.`MaKhachHang` IS NULL;

-- Delete the customer-less booking graph from leaves to root.
DELETE refund_rows
FROM `lich_su_hoan_tien` refund_rows
INNER JOIN `giao_dich` transaction_rows
    ON transaction_rows.`MaGiaoDich` = refund_rows.`MaGiaoDich`
INNER JOIN `phieu_dat_ve` booking_rows
    ON booking_rows.`MaPhieuDat` = transaction_rows.`MaPhieuDat`
WHERE booking_rows.`MaKhachHang` IS NULL;

DELETE transaction_rows
FROM `giao_dich` transaction_rows
INNER JOIN `phieu_dat_ve` booking_rows
    ON booking_rows.`MaPhieuDat` = transaction_rows.`MaPhieuDat`
WHERE booking_rows.`MaKhachHang` IS NULL;

DELETE ticket_rows
FROM `chi_tiet_dat_ve` ticket_rows
INNER JOIN `phieu_dat_ve` booking_rows
    ON booking_rows.`MaPhieuDat` = ticket_rows.`MaPhieuDat`
WHERE booking_rows.`MaKhachHang` IS NULL;

DELETE booking_rows
FROM `phieu_dat_ve` booking_rows
WHERE booking_rows.`MaKhachHang` IS NULL;

UPDATE `ghe_suat_chieu` seat_rows
INNER JOIN `_removed_booking_seats` removed_seats
    ON removed_seats.`MaGheSuatChieu` = seat_rows.`MaGheSuatChieu`
SET seat_rows.`TrangThai` = 'TRONG',
    seat_rows.`ThoiGianGiuGhe` = NULL,
    seat_rows.`MaTaiKhoanGiu` = NULL
WHERE NOT (
    seat_rows.`TrangThai` = 'DANG_GIU'
    AND seat_rows.`MaTaiKhoanGiu` IS NOT NULL
    AND seat_rows.`ThoiGianGiuGhe` >= CURRENT_TIMESTAMP(3)
)
AND NOT EXISTS (
    SELECT 1
    FROM `chi_tiet_dat_ve` current_tickets
    INNER JOIN `phieu_dat_ve` current_bookings
        ON current_bookings.`MaPhieuDat` = current_tickets.`MaPhieuDat`
    WHERE current_tickets.`MaGheSuatChieu` = seat_rows.`MaGheSuatChieu`
      AND current_tickets.`KhaDung` = true
      AND current_bookings.`KhaDung` = true
      AND current_bookings.`TrangThai` IN ('CHO_THANH_TOAN', 'DA_THANH_TOAN')
);

DROP TEMPORARY TABLE `_removed_booking_seats`;

-- Remove transient references owned by accounts that are about to disappear.
UPDATE `ghe_suat_chieu` held_seats
INNER JOIN `tai_khoan` staff_accounts
    ON staff_accounts.`MaTaiKhoan` = held_seats.`MaTaiKhoanGiu`
SET held_seats.`TrangThai` = 'TRONG',
    held_seats.`ThoiGianGiuGhe` = NULL,
    held_seats.`MaTaiKhoanGiu` = NULL
WHERE staff_accounts.`VaiTro` = 'STAFF';

DELETE refresh_tokens
FROM `refresh_token` refresh_tokens
INNER JOIN `tai_khoan` staff_accounts
    ON staff_accounts.`MaTaiKhoan` = refresh_tokens.`MaTaiKhoan`
WHERE staff_accounts.`VaiTro` = 'STAFF';

DELETE reset_otps
FROM `password_reset_otp` reset_otps
INNER JOIN `tai_khoan` staff_accounts
    ON staff_accounts.`MaTaiKhoan` = reset_otps.`MaTaiKhoan`
WHERE staff_accounts.`VaiTro` = 'STAFF';

-- Remove Staff/check-in relations before dropping the Staff tables.
ALTER TABLE `chi_tiet_dat_ve`
    DROP FOREIGN KEY `chi_tiet_dat_ve_MaNhanVienCheckIn_fkey`,
    DROP INDEX `chi_tiet_dat_ve_MaNhanVienCheckIn_idx`,
    DROP COLUMN `DaCheckIn`,
    DROP COLUMN `ThoiGianCheckIn`,
    DROP COLUMN `MaNhanVienCheckIn`;

ALTER TABLE `phieu_dat_ve`
    DROP FOREIGN KEY `phieu_dat_ve_MaNhanVien_fkey`,
    DROP INDEX `phieu_dat_ve_MaNhanVien_idx`,
    DROP COLUMN `MaNhanVien`;

DROP TABLE `chi_tiet_ca_lam_viec`;
DROP TABLE `ca_lam_viec`;
DROP TABLE `nhan_vien`;

DELETE staff_accounts
FROM `tai_khoan` staff_accounts
WHERE staff_accounts.`VaiTro` = 'STAFF';

-- Every surviving booking now belongs to a Customer.
ALTER TABLE `phieu_dat_ve`
    DROP FOREIGN KEY `phieu_dat_ve_MaKhachHang_fkey`;

ALTER TABLE `phieu_dat_ve`
    MODIFY `MaKhachHang` VARCHAR(36) NOT NULL;

ALTER TABLE `phieu_dat_ve`
    ADD CONSTRAINT `phieu_dat_ve_MaKhachHang_fkey`
    FOREIGN KEY (`MaKhachHang`) REFERENCES `khach_hang`(`MaKhachHang`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `tai_khoan`
    MODIFY `VaiTro` ENUM('ADMIN', 'CUSTOMER') NOT NULL;

ALTER TABLE `cau_hinh_van_hanh`
    DROP COLUMN `CuaSoCheckInPhut`,
    DROP COLUMN `HanHuyCaTruocGio`;
