ALTER TABLE `phieu_dat_ve`
    DROP FOREIGN KEY `phieu_dat_ve_MaKhachHang_fkey`;

ALTER TABLE `phieu_dat_ve`
    MODIFY `MaKhachHang` VARCHAR(36) NULL,
    ADD COLUMN `KenhDat` ENUM('TRUC_TUYEN', 'TAI_QUAY') NOT NULL DEFAULT 'TRUC_TUYEN',
    ADD COLUMN `TenKhachHangTaiQuay` VARCHAR(255) NULL,
    ADD COLUMN `SoDienThoaiTaiQuay` VARCHAR(20) NULL;

ALTER TABLE `phieu_dat_ve`
    ADD CONSTRAINT `phieu_dat_ve_MaKhachHang_fkey`
    FOREIGN KEY (`MaKhachHang`) REFERENCES `khach_hang`(`MaKhachHang`)
    ON DELETE RESTRICT ON UPDATE CASCADE;
