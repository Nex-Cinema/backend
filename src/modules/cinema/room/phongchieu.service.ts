import { PhongChieu, Ghe, SoDoGhe } from '@prisma/client';
import {
  findPhongChieus,
  findPhongChieuById,
  createPhongChieu,
  updatePhongChieu,
  deletePhongChieu,
  findDuplicateRoomName,
  findSoDoGheById,
  findLoaiGheByTen,
  findFirstLoaiGhe,
  findGhesByPhong,
  createGhes,
  countRelatedTickets,
  findShowtimesByRoom,
} from './phongchieu.repository';
import {
  CreatePhongChieuInput,
  UpdatePhongChieuInput,
  UpdateGhesInput,
} from './phongchieu.validator';
import { NotFoundError, BadRequestError } from '../../../utils/errors';
import prisma from '../../../config/prisma';

// ==========================================
// Helper: Map row index to letter
// (1 -> A, 2 -> B, ..., 27 -> AA)
// ==========================================
export const getRowLetter = (index: number): string => {
  let letter = '';
  let temp = index - 1;
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
};

export const checkIsAisle = (rIndex: number, cIndex: number, CauTruc: string | null): boolean => {
  if (!CauTruc) return false;
  try {
    const struct = typeof CauTruc === 'string' ? JSON.parse(CauTruc) : CauTruc;
    if (!struct || !struct.aisles) return false;

    if (struct.aisles.cols && struct.aisles.cols.includes(cIndex + 1)) {
      return true;
    }
    if (struct.aisles.rows && struct.aisles.rows.includes(rIndex + 1)) {
      return true;
    }
    if (struct.aisles.custom) {
      const customRow = struct.aisles.custom.find((item: any) => item.row === rIndex);
      if (customRow) {
        if (customRow.cols.includes(cIndex) || customRow.cols.includes(cIndex + 1)) {
          return true;
        }
      }
    }
  } catch (e) {
    // Ignore
  }
  return false;
};

type CouplePlacement = 'start' | 'covered' | null;

export const getCouplePlacement = (
  row: number,
  column: number,
  structureValue: string | null,
): CouplePlacement => {
  if (!structureValue) return null;
  try {
    const structure = JSON.parse(structureValue);
    const couples = Array.isArray(structure?.couples) ? structure.couples : [];
    if (couples.some((item: { row: number; startCol: number }) => item.row === row && item.startCol === column)) return 'start';
    if (couples.some((item: { row: number; startCol: number }) => item.row === row && item.startCol + 1 === column)) return 'covered';
  } catch {
    return null;
  }
  return null;
};

// ==========================================
// Helper: Assert screening room exists
// ==========================================
const assertPhongChieuExists = async (maPhong: string): Promise<PhongChieu> => {
  const room = await findPhongChieuById(maPhong);
  if (!room) {
    throw new NotFoundError(`Không tìm thấy phòng chiếu với mã: ${maPhong}`);
  }
  return room;
};

// ==========================================
// Service: Get list of screening rooms
// ==========================================
export const getDanhSachPhongChieu = async () => {
  return findPhongChieus();
};

// ==========================================
// Service: Get single screening room details
// ==========================================
export const getChiTietPhongChieu = async (maPhong: string) => {
  return assertPhongChieuExists(maPhong);
};

// ==========================================
// Service: Create a new screening room and auto-generate seats
// ==========================================
export const taoPhongChieu = async (input: CreatePhongChieuInput): Promise<PhongChieu> => {
  // 1. Check room name duplicate
  const duplicate = await findDuplicateRoomName(input.TenPhong);
  if (duplicate) {
    throw new BadRequestError(`Tên phòng chiếu "${input.TenPhong}" đã tồn tại`);
  }

  // 2. Fetch the seat map template
  const soDo = await findSoDoGheById(input.MaSoDo);
  if (!soDo) {
    throw new NotFoundError(`Không tìm thấy sơ đồ ghế mẫu`);
  }

  // 3. Find default seat type ("Thường" or fallback)
  let defaultLoaiGhe = await findLoaiGheByTen('Thường');
  if (!defaultLoaiGhe) {
    defaultLoaiGhe = await findFirstLoaiGhe();
  }
  if (!defaultLoaiGhe) {
    throw new BadRequestError('Không tìm thấy bất kỳ loại ghế nào đang khả dụng để gán mặc định');
  }

  const defaultMaLoaiGhe = defaultLoaiGhe.MaLoaiGhe;
  const coupleLoaiGhe = await findLoaiGheByTen('Sweetbox');

  // 4. Create Room & Seats in a single transaction
  return prisma.$transaction(async (tx) => {
    // Create the room
    const newRoom = await tx.phongChieu.create({
      data: {
        TenPhong: input.TenPhong,
        MaLoaiPhong: input.MaLoaiPhong,
        MaSoDo: input.MaSoDo,
        KhaDung: input.KhaDung ?? true,
      },
    });

    // Generate seats
    const seatsToCreate: any[] = [];
    for (let r = 1; r <= soDo.SoHang; r++) {
      const rowLetter = getRowLetter(r);
      for (let c = 1; c <= soDo.SoCot; c++) {
        const couplePlacement = getCouplePlacement(r, c, soDo.CauTruc);
        if (couplePlacement === 'covered') continue;
        if (checkIsAisle(r - 1, c - 1, soDo.CauTruc)) {
          continue;
        }
        if (couplePlacement === 'start' && !coupleLoaiGhe) {
          throw new BadRequestError('Sơ đồ có ghế đôi nhưng hệ thống chưa cấu hình loại ghế Sweetbox');
        }
        seatsToCreate.push({
          ViTriDay: rowLetter,
          ViTriCot: c,
          MaPhong: newRoom.MaPhong,
          MaLoaiGhe: couplePlacement === 'start' ? coupleLoaiGhe!.MaLoaiGhe : defaultMaLoaiGhe,
          DoRongCot: couplePlacement === 'start' ? 2 : 1,
          SucChua: couplePlacement === 'start' ? 2 : 1,
          KhaDung: true,
        });
      }
    }

    // Insert all generated seats
    await tx.ghe.createMany({
      data: seatsToCreate,
    });

    return newRoom;
  });
};

// ==========================================
// Service: Update a screening room (with optional seat regeneration)
// ==========================================
export const capNhatPhongChieu = async (
  maPhong: string,
  input: UpdatePhongChieuInput,
): Promise<PhongChieu> => {
  const existing = await assertPhongChieuExists(maPhong);

  // 1. Check duplicate name if changing TenPhong
  if (input.TenPhong && input.TenPhong !== existing.TenPhong) {
    const duplicate = await findDuplicateRoomName(input.TenPhong, maPhong);
    if (duplicate) {
      throw new BadRequestError(`Tên phòng chiếu "${input.TenPhong}" đã tồn tại`);
    }
  }

  // Check if updating room type or seat map template affects active showtimes
  const affectsRoomDetails =
    (input.MaLoaiPhong && input.MaLoaiPhong !== existing.MaLoaiPhong) ||
    (input.MaSoDo && input.MaSoDo !== existing.MaSoDo);

  if (affectsRoomDetails) {
    const activeTicketCount = await prisma.gheSuatChieu.count({
      where: {
        SuatChieu: { MaPhong: maPhong },
        TrangThai: { in: ['DA_DAT', 'DANG_GIU'] },
      },
    });
    if (activeTicketCount > 0) {
      throw new BadRequestError(
        'Không thể cập nhật thông tin phòng chiếu (sơ đồ ghế, loại phòng) khi suất chiếu của phòng này đã được bán vé hoặc đang giữ ghế.',
      );
    }
  }

  // 2. Handle MaSoDo (Seat map template) update
  if (input.MaSoDo && input.MaSoDo !== existing.MaSoDo) {
    // Check if the room already has showtimes
    const showtimeCount = await prisma.suatChieu.count({
      where: { MaPhong: maPhong },
    });
    if (showtimeCount > 0) {
      throw new BadRequestError('Không thể thay đổi sơ đồ ghế của phòng chiếu đã được lên lịch suất chiếu');
    }

    // Fetch the new seat map template
    const newSoDo = await findSoDoGheById(input.MaSoDo);
    if (!newSoDo) {
      throw new NotFoundError(`Không tìm thấy sơ đồ ghế mẫu mới`);
    }

    // Find default seat type
    let defaultLoaiGhe = await findLoaiGheByTen('Thường');
    if (!defaultLoaiGhe) {
      defaultLoaiGhe = await findFirstLoaiGhe();
    }
    if (!defaultLoaiGhe) {
      throw new BadRequestError('Không tìm thấy loại ghế mặc định để tạo lại sơ đồ ghế');
    }

    const defaultMaLoaiGhe = defaultLoaiGhe.MaLoaiGhe;
    const coupleLoaiGhe = await findLoaiGheByTen('Sweetbox');

    return prisma.$transaction(async (tx) => {
      // Delete old seats
      await tx.ghe.deleteMany({
        where: { MaPhong: maPhong },
      });

      // Update room details
      const updatedRoom = await tx.phongChieu.update({
        where: { MaPhong: maPhong },
        data: {
          ...(input.TenPhong !== undefined && { TenPhong: input.TenPhong }),
          ...(input.MaLoaiPhong !== undefined && { MaLoaiPhong: input.MaLoaiPhong }),
          MaSoDo: input.MaSoDo,
          ...(input.KhaDung !== undefined && { KhaDung: input.KhaDung }),
        },
      });

      // Generate new seats
      const seatsToCreate: any[] = [];
      for (let r = 1; r <= newSoDo.SoHang; r++) {
        const rowLetter = getRowLetter(r);
        for (let c = 1; c <= newSoDo.SoCot; c++) {
          const couplePlacement = getCouplePlacement(r, c, newSoDo.CauTruc);
          if (couplePlacement === 'covered') continue;
          if (checkIsAisle(r - 1, c - 1, newSoDo.CauTruc)) {
            continue;
          }
          if (couplePlacement === 'start' && !coupleLoaiGhe) {
            throw new BadRequestError('Sơ đồ có ghế đôi nhưng hệ thống chưa cấu hình loại ghế Sweetbox');
          }
          seatsToCreate.push({
            ViTriDay: rowLetter,
            ViTriCot: c,
            MaPhong: maPhong,
            MaLoaiGhe: couplePlacement === 'start' ? coupleLoaiGhe!.MaLoaiGhe : defaultMaLoaiGhe,
            DoRongCot: couplePlacement === 'start' ? 2 : 1,
            SucChua: couplePlacement === 'start' ? 2 : 1,
            KhaDung: true,
          });
        }
      }

      await tx.ghe.createMany({
        data: seatsToCreate,
      });

      return updatedRoom;
    });
  }

  // 3. Simple update without seat regeneration
  return updatePhongChieu(maPhong, {
    ...(input.TenPhong !== undefined && { TenPhong: input.TenPhong }),
    ...(input.MaLoaiPhong !== undefined && { MaLoaiPhong: input.MaLoaiPhong }),
    ...(input.KhaDung !== undefined && { KhaDung: input.KhaDung }),
  });
};

// ==========================================
// Service: Delete a screening room
// ==========================================
export const xoaPhongChieu = async (maPhong: string): Promise<void> => {
  await assertPhongChieuExists(maPhong);

  // 1. Check if tickets have been sold
  const ticketCount = await countRelatedTickets(maPhong);
  if (ticketCount > 0) {
    throw new BadRequestError('Không thể xóa phòng chiếu này vì đã có vé được bán ra.');
  }

  // 2. Cascade delete all dependencies in transaction
  await prisma.$transaction(async (tx) => {
    // Find all showtimes for this room
    const showtimes = await tx.suatChieu.findMany({
      where: { MaPhong: maPhong },
      select: { MaSuatChieu: true },
    });
    const showtimeIds = showtimes.map((s) => s.MaSuatChieu);

    if (showtimeIds.length > 0) {
      // Delete showtime seats (GheSuatChieu)
      await tx.gheSuatChieu.deleteMany({
        where: { MaSuatChieu: { in: showtimeIds } },
      });

      // Delete showtimes (SuatChieu)
      await tx.suatChieu.deleteMany({
        where: { MaPhong: maPhong },
      });
    }

    // Delete room seats (Ghe)
    await tx.ghe.deleteMany({
      where: { MaPhong: maPhong },
    });

    // Delete screening room itself
    await tx.phongChieu.delete({
      where: { MaPhong: maPhong },
    });
  });
};

// ==========================================
// Service: Get seats for a specific room
// ==========================================
export const getDanhSachGhe = async (maPhong: string): Promise<Ghe[]> => {
  await assertPhongChieuExists(maPhong);
  return findGhesByPhong(maPhong);
};

// ==========================================
// Service: Bulk update seats configuration
// ==========================================
export const capNhatCauHinhGhe = async (maPhong: string, input: UpdateGhesInput): Promise<void> => {
  await assertPhongChieuExists(maPhong);

  const activeTicketCount = await prisma.gheSuatChieu.count({
    where: {
      SuatChieu: { MaPhong: maPhong },
      TrangThai: { in: ['DA_DAT', 'DANG_GIU'] },
    },
  });
  if (activeTicketCount > 0) {
    throw new BadRequestError(
      'Không thể cập nhật cấu hình ghế của phòng chiếu khi suất chiếu của phòng này đã được bán vé hoặc đang giữ ghế.',
    );
  }

  // Update in a transaction
  await prisma.$transaction(async (tx) => {
    for (const item of input.ghes) {
      // Find seat and verify it belongs to the screening room
      const seat = await tx.ghe.findUnique({
        where: { MaGhe: item.maGhe },
      });

      if (!seat) {
        throw new NotFoundError(`Không tìm thấy ghế với mã: ${item.maGhe}`);
      }

      if (seat.MaPhong !== maPhong) {
        throw new BadRequestError(`Ghế với mã: ${item.maGhe} không thuộc phòng chiếu này`);
      }

      // Verify that the seat type exists
      const seatType = await tx.loaiGhe.findUnique({
        where: { MaLoaiGhe: item.maLoaiGhe },
      });
      if (!seatType) {
        throw new NotFoundError(`Không tìm thấy loại ghế với mã: ${item.maLoaiGhe}`);
      }

      const isCoupleSeatType = seatType.TenLoaiGhe.toLowerCase() === 'sweetbox';
      if (seat.DoRongCot > 1 && !isCoupleSeatType) {
        throw new BadRequestError(
          `Ghế ${seat.ViTriDay}${seat.ViTriCot} chiếm ${seat.DoRongCot} cột và phải giữ loại Sweetbox.`,
        );
      }
      if (seat.DoRongCot === 1 && isCoupleSeatType) {
        throw new BadRequestError(
          `Ghế ${seat.ViTriDay}${seat.ViTriCot} chỉ chiếm 1 cột. Hãy khai báo ghế đôi trong cấu trúc sơ đồ trước.`,
        );
      }

      // Update seat configuration
      await tx.ghe.update({
        where: { MaGhe: item.maGhe },
        data: {
          MaLoaiGhe: item.maLoaiGhe,
          KhaDung: item.khaDung,
        },
      });
    }
  });
};
