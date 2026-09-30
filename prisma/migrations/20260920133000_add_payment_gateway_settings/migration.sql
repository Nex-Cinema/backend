CREATE TABLE `cau_hinh_cong_thanh_toan` (
  `NhaCungCap` VARCHAR(20) NOT NULL,
  `KichHoat` BOOLEAN NOT NULL DEFAULT true,
  `NgayCapNhat` DATETIME(3) NOT NULL,
  PRIMARY KEY (`NhaCungCap`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `cau_hinh_cong_thanh_toan` (`NhaCungCap`, `KichHoat`, `NgayCapNhat`)
VALUES ('PAYOS', true, NOW()), ('VNPAY', true, NOW());
