import { LoaiPhong, LoaiGhe, LoaiNgay } from '@prisma/client';
import {
  findLoaiPhongs,
  findLoaiPhongById,
  createLoaiPhong,
  updateLoaiPhong,
  deleteLoaiPhong,
  countRoomsWithLoaiPhong,
  findLoaiGhes,
  findLoaiGheById,
  createLoaiGhe,
  updateLoaiGhe,
  deleteLoaiGhe,
  countSeatsWithLoaiGhe,
  findLoaiNgays,
  findLoaiNgayById,
  createLoaiNgay,
  updateLoaiNgay,
  deleteLoaiNgay,
  countShowtimesWithLoaiNgay,
} from './metadata.repository';
import {
  CreateLoaiPhongInput,
  UpdateLoaiPhongInput,
  CreateLoaiGheInput,
  UpdateLoaiGheInput,
  CreateLoaiNgayInput,
  UpdateLoaiNgayInput,
} from './metadata.validator';
import { NotFoundError } from '../../../utils/errors';

// ==========================================
// Helpers: Assertion functions
// ==========================================

const assertLoaiPhongExists = async (maLoaiPhong: string): Promise<LoaiPhong> => {
  const loaiPhong = await findLoaiPhongById(maLoaiPhong);
  if (!loaiPhong) {
    throw new NotFoundError(`Không tìm thấy loại phòng với mã: ${maLoaiPhong}`);
  }
  return loaiPhong;
};

const assertLoaiGheExists = async (maLoaiGhe: string): Promise<LoaiGhe> => {
  const loaiGhe = await findLoaiGheById(maLoaiGhe);
  if (!loaiGhe) {
    throw new NotFoundError(`Không tìm thấy loại ghế với mã: ${maLoaiGhe}`);
  }
  return loaiGhe;
};

const assertLoaiNgayExists = async (maLoaiNgay: string): Promise<LoaiNgay> => {
  const loaiNgay = await findLoaiNgayById(maLoaiNgay);
  if (!loaiNgay) {
    throw new NotFoundError(`Không tìm thấy loại ngày với mã: ${maLoaiNgay}`);
  }
  return loaiNgay;
};

// ==========================================
// 1. LOẠI PHÒNG SERVICES
// ==========================================

export const getLoaiPhongs = async (): Promise<LoaiPhong[]> => {
  return findLoaiPhongs();
};

export const getLoaiPhongById = async (maLoaiPhong: string): Promise<LoaiPhong> => {
  return assertLoaiPhongExists(maLoaiPhong);
};

export const taoLoaiPhong = async (input: CreateLoaiPhongInput): Promise<LoaiPhong> => {
  return createLoaiPhong({
    TenLoaiPhong: input.TenLoaiPhong,
    PhuThu: input.PhuThu,
  });
};

export const capNhatLoaiPhong = async (
  maLoaiPhong: string,
  input: UpdateLoaiPhongInput,
): Promise<LoaiPhong> => {
  await assertLoaiPhongExists(maLoaiPhong);
  return updateLoaiPhong(maLoaiPhong, input);
};

export const xoaLoaiPhong = async (maLoaiPhong: string): Promise<{ action: 'soft' | 'hard'; data: LoaiPhong }> => {
  await assertLoaiPhongExists(maLoaiPhong);

  const roomCount = await countRoomsWithLoaiPhong(maLoaiPhong);

  if (roomCount > 0) {
    // Soft delete: update KhaDung = false
    const updated = await updateLoaiPhong(maLoaiPhong, { KhaDung: false });
    return { action: 'soft', data: updated };
  } else {
    // Hard delete
    const deleted = await deleteLoaiPhong(maLoaiPhong);
    return { action: 'hard', data: deleted };
  }
};

// ==========================================
// 2. LOẠI GHẾ SERVICES
// ==========================================

export const getLoaiGhes = async (): Promise<LoaiGhe[]> => {
  return findLoaiGhes();
};

export const getLoaiGheById = async (maLoaiGhe: string): Promise<LoaiGhe> => {
  return assertLoaiGheExists(maLoaiGhe);
};

export const taoLoaiGhe = async (input: CreateLoaiGheInput): Promise<LoaiGhe> => {
  return createLoaiGhe({
    TenLoaiGhe: input.TenLoaiGhe,
    PhuThu: input.PhuThu,
  });
};

export const capNhatLoaiGhe = async (
  maLoaiGhe: string,
  input: UpdateLoaiGheInput,
): Promise<LoaiGhe> => {
  await assertLoaiGheExists(maLoaiGhe);
  return updateLoaiGhe(maLoaiGhe, input);
};

export const xoaLoaiGhe = async (maLoaiGhe: string): Promise<{ action: 'soft' | 'hard'; data: LoaiGhe }> => {
  await assertLoaiGheExists(maLoaiGhe);

  const seatCount = await countSeatsWithLoaiGhe(maLoaiGhe);

  if (seatCount > 0) {
    // Soft delete: update KhaDung = false
    const updated = await updateLoaiGhe(maLoaiGhe, { KhaDung: false });
    return { action: 'soft', data: updated };
  } else {
    // Hard delete
    const deleted = await deleteLoaiGhe(maLoaiGhe);
    return { action: 'hard', data: deleted };
  }
};

// ==========================================
// 3. LOẠI NGÀY SERVICES
// ==========================================

export const getLoaiNgays = async (): Promise<LoaiNgay[]> => {
  return findLoaiNgays();
};

export const getLoaiNgayById = async (maLoaiNgay: string): Promise<LoaiNgay> => {
  return assertLoaiNgayExists(maLoaiNgay);
};

export const taoLoaiNgay = async (input: CreateLoaiNgayInput): Promise<LoaiNgay> => {
  return createLoaiNgay({
    TenLoaiNgay: input.TenLoaiNgay,
    PhuThu: input.PhuThu,
  });
};

export const capNhatLoaiNgay = async (
  maLoaiNgay: string,
  input: UpdateLoaiNgayInput,
): Promise<LoaiNgay> => {
  await assertLoaiNgayExists(maLoaiNgay);
  return updateLoaiNgay(maLoaiNgay, input);
};

export const xoaLoaiNgay = async (maLoaiNgay: string): Promise<{ action: 'soft' | 'hard'; data: LoaiNgay }> => {
  await assertLoaiNgayExists(maLoaiNgay);

  const showtimeCount = await countShowtimesWithLoaiNgay(maLoaiNgay);

  if (showtimeCount > 0) {
    // Soft delete: update KhaDung = false
    const updated = await updateLoaiNgay(maLoaiNgay, { KhaDung: false });
    return { action: 'soft', data: updated };
  } else {
    // Hard delete
    const deleted = await deleteLoaiNgay(maLoaiNgay);
    return { action: 'hard', data: deleted };
  }
};
