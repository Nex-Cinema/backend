CREATE TABLE `cau_hinh_van_hanh` (
    `Id` INTEGER NOT NULL DEFAULT 1,
    `ThoiGianGiuGhePhut` INTEGER NOT NULL DEFAULT 10,
    `CuaSoCheckInPhut` INTEGER NOT NULL DEFAULT 30,
    `HanHuyCaTruocGio` INTEGER NOT NULL DEFAULT 2,
    `NgayCapNhat` DATETIME(3) NOT NULL,

    PRIMARY KEY (`Id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `cau_hinh_van_hanh`
    (`Id`, `ThoiGianGiuGhePhut`, `CuaSoCheckInPhut`, `HanHuyCaTruocGio`, `NgayCapNhat`)
VALUES
    (1, 10, 30, 2, CURRENT_TIMESTAMP(3));
