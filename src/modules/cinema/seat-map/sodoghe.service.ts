import { SoDoGhe } from '@prisma/client';
import prisma from '../../../config/prisma';
import {
  findSoDoGhes,
  findSoDoGheById,
  createSoDoGhe,
  updateSoDoGhe,
  deleteSoDoGhe,
  countRoomsWithSoDoGhe,
} from './sodoghe.repository';
import { CreateSoDoGheInput, UpdateSoDoGheInput } from './sodoghe.validator';
import { NotFoundError, BadRequestError } from '../../../utils/errors';

const assertSoDoGheExists = async (maSoDo: string): Promise<SoDoGhe> => {
  const sodoghe = await findSoDoGheById(maSoDo);
  if (!sodoghe) {
    throw new NotFoundError(`Không tìm thấy sơ đồ ghế mẫu với mã: ${maSoDo}`);
  }
  return sodoghe;
};

export const getSoDoGhes = async (): Promise<SoDoGhe[]> => {
  return findSoDoGhes();
};

export const getSoDoGheById = async (maSoDo: string): Promise<SoDoGhe> => {
  return assertSoDoGheExists(maSoDo);
};

export const taoSoDoGhe = async (input: CreateSoDoGheInput): Promise<SoDoGhe> => {
  return createSoDoGhe({
    TenSoDo: input.TenSoDo,
    SoHang: input.SoHang,
    SoCot: input.SoCot,
    CauTruc: input.CauTruc,
    KhaDung: true,
  });
};

export const capNhatSoDoGhe = async (
  maSoDo: string,
  input: UpdateSoDoGheInput,
): Promise<SoDoGhe> => {
  const sodoghe = await assertSoDoGheExists(maSoDo);

  // If template is being modified, verify that rooms using this template do not have active showtimes with sold tickets
  const activeTicketCount = await prisma.gheSuatChieu.count({
    where: {
      SuatChieu: {
        PhongChieu: { MaSoDo: maSoDo }
      },
      TrangThai: { in: ['DA_DAT', 'DANG_GIU'] }
    }
  });
  if (activeTicketCount > 0) {
    throw new BadRequestError('Không thể cập nhật sơ đồ ghế mẫu đang được sử dụng bởi phòng chiếu có suất chiếu đã bán vé hoặc đang giữ ghế.');
  }

  // If size is changing, verify it is not in use
  const isSizeChanging =
    (input.SoHang !== undefined && input.SoHang !== sodoghe.SoHang) ||
    (input.SoCot !== undefined && input.SoCot !== sodoghe.SoCot);

  if (isSizeChanging) {
    const roomsCount = await countRoomsWithSoDoGhe(maSoDo);
    if (roomsCount > 0) {
      throw new BadRequestError(
        'Không thể sửa số hàng hoặc số cột của sơ đồ ghế đang được phòng chiếu sử dụng',
      );
    }
  }

  return updateSoDoGhe(maSoDo, {
    TenSoDo: input.TenSoDo,
    SoHang: input.SoHang,
    SoCot: input.SoCot,
    CauTruc: input.CauTruc,
    KhaDung: input.KhaDung,
  });
};

export const xoaSoDoGhe = async (
  maSoDo: string,
): Promise<{ action: 'soft' | 'hard'; data: SoDoGhe | null }> => {
  await assertSoDoGheExists(maSoDo);

  const roomsCount = await countRoomsWithSoDoGhe(maSoDo);
  if (roomsCount > 0) {
    // Soft delete
    const data = await updateSoDoGhe(maSoDo, { KhaDung: false });
    return { action: 'soft', data };
  }

  // Hard delete
  await deleteSoDoGhe(maSoDo);
  return { action: 'hard', data: null };
};
