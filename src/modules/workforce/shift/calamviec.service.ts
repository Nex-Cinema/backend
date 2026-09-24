import { CaLamViec, ChiTietCaLamViec } from '@prisma/client';
import prisma from '../../../config/prisma';
import {
  CreateCaLamViecInput,
  UpdateCaLamViecInput,
  PhanCaInput,
  LichTrucQueryInput,
} from './calamviec.validator';
import { NotFoundError, ConflictError, BadRequestError } from '../../../utils/errors';

export const createCaLamViec = async (input: CreateCaLamViecInput): Promise<CaLamViec> => {
  const duplicate = await prisma.caLamViec.findFirst({
    where: { TenCa: input.TenCa },
  });

  if (duplicate) {
    throw new ConflictError('Tên ca làm việc đã tồn tại');
  }

  // Parse time strings (e.g. "08:00:00") into Date objects (referencing UTC epoch)
  const gioBatDau = new Date(`1970-01-01T${input.GioBatDau}Z`);
  const gioKetThuc = new Date(`1970-01-01T${input.GioKetThuc}Z`);

  if (gioBatDau >= gioKetThuc) {
    throw new BadRequestError('Giờ bắt đầu phải nhỏ hơn giờ kết thúc');
  }

  return prisma.caLamViec.create({
    data: {
      TenCa: input.TenCa,
      GioBatDau: gioBatDau,
      GioKetThuc: gioKetThuc,
      SoNguoiToiDa: input.SoNguoiToiDa,
      KhaDung: true,
    },
  });
};

export const getDanhSachCaLamViec = async (): Promise<CaLamViec[]> => {
  return prisma.caLamViec.findMany({
    orderBy: { GioBatDau: 'asc' },
  });
};

export const getChiTietCaLamViec = async (maCa: string): Promise<CaLamViec> => {
  const ca = await prisma.caLamViec.findUnique({
    where: { MaCa: maCa },
  });

  if (!ca) {
    throw new NotFoundError('Không tìm thấy ca làm việc');
  }

  return ca;
};

export const updateCaLamViec = async (
  maCa: string,
  input: UpdateCaLamViecInput,
): Promise<CaLamViec> => {
  const ca = await prisma.caLamViec.findUnique({
    where: { MaCa: maCa },
  });

  if (!ca) {
    throw new NotFoundError('Không tìm thấy ca làm việc');
  }

  if (input.TenCa && input.TenCa !== ca.TenCa) {
    const duplicate = await prisma.caLamViec.findFirst({
      where: { TenCa: input.TenCa },
    });
    if (duplicate) {
      throw new ConflictError('Tên ca làm việc đã tồn tại');
    }
  }

  const gioBatDau = input.GioBatDau
    ? new Date(`1970-01-01T${input.GioBatDau}Z`)
    : ca.GioBatDau;
  const gioKetThuc = input.GioKetThuc
    ? new Date(`1970-01-01T${input.GioKetThuc}Z`)
    : ca.GioKetThuc;

  if (gioBatDau >= gioKetThuc) {
    throw new BadRequestError('Giờ bắt đầu phải nhỏ hơn giờ kết thúc');
  }

  return prisma.caLamViec.update({
    where: { MaCa: maCa },
    data: {
      TenCa: input.TenCa,
      GioBatDau: gioBatDau,
      GioKetThuc: gioKetThuc,
      SoNguoiToiDa: input.SoNguoiToiDa,
    },
  });
};

export const deleteCaLamViec = async (
  maCa: string,
): Promise<{ action: 'soft' | 'hard'; data: CaLamViec | null }> => {
  const ca = await prisma.caLamViec.findUnique({
    where: { MaCa: maCa },
  });

  if (!ca) {
    throw new NotFoundError('Không tìm thấy ca làm việc');
  }

  // Check if assigned to any employee shift
  const assignedCount = await prisma.chiTietCaLamViec.count({
    where: { MaCa: maCa },
  });

  if (assignedCount > 0) {
    const updated = await prisma.caLamViec.update({
      where: { MaCa: maCa },
      data: { KhaDung: false },
    });
    return { action: 'soft', data: updated };
  }

  await prisma.caLamViec.delete({
    where: { MaCa: maCa },
  });

  return { action: 'hard', data: null };
};

export const phanCaLamViec = async (input: PhanCaInput): Promise<ChiTietCaLamViec> => {
  const [nhanVien, ca] = await Promise.all([
    prisma.nhanVien.findUnique({ where: { MaNhanVien: input.MaNhanVien } }),
    prisma.caLamViec.findUnique({ where: { MaCa: input.MaCa } }),
  ]);

  if (!nhanVien) {
    throw new NotFoundError('Không tìm thấy nhân viên');
  }

  if (!ca) {
    throw new NotFoundError('Không tìm thấy ca làm việc mẫu');
  }

  const ngayLamViec = new Date(input.NgayLamViec);

  // Check duplicate assignment
  const duplicate = await prisma.chiTietCaLamViec.findFirst({
    where: {
      MaNhanVien: input.MaNhanVien,
      MaCa: input.MaCa,
      NgayLamViec: ngayLamViec,
    },
  });

  if (duplicate) {
    throw new ConflictError('Nhân viên này đã được xếp vào ca này trong ngày đã chọn');
  }

  return prisma.chiTietCaLamViec.create({
    data: {
      MaNhanVien: input.MaNhanVien,
      MaCa: input.MaCa,
      NgayLamViec: ngayLamViec,
      KhaDung: true,
    },
    include: {
      CaLamViec: true,
      NhanVien: {
        include: {
          TaiKhoan: {
            select: {
              HoTen: true,
              Email: true,
              SoDienThoai: true,
            },
          },
        },
      },
    },
  });
};

export const getLichTruc = async (query: LichTrucQueryInput): Promise<ChiTietCaLamViec[]> => {
  const { tuNgay, denNgay, maNhanVien, maCa } = query;

  const where: any = {};

  if (tuNgay || denNgay) {
    where.NgayLamViec = {};
    if (tuNgay) {
      where.NgayLamViec.gte = new Date(tuNgay);
    }
    if (denNgay) {
      where.NgayLamViec.lte = new Date(denNgay);
    }
  }

  if (maNhanVien) {
    where.MaNhanVien = maNhanVien;
  }

  if (maCa) {
    where.MaCa = maCa;
  }

  return prisma.chiTietCaLamViec.findMany({
    where,
    include: {
      CaLamViec: true,
      NhanVien: {
        include: {
          TaiKhoan: {
            select: {
              HoTen: true,
              Email: true,
              SoDienThoai: true,
            },
          },
        },
      },
    },
    orderBy: [
      { NgayLamViec: 'asc' },
      { CaLamViec: { GioBatDau: 'asc' } },
    ],
  });
};

export const huyPhanCa = async (maChiTietCa: string): Promise<void> => {
  const assigned = await prisma.chiTietCaLamViec.findUnique({
    where: { MaChiTietCa: maChiTietCa },
  });

  if (!assigned) {
    throw new NotFoundError('Không tìm thấy lịch phân ca');
  }

  await prisma.chiTietCaLamViec.delete({
    where: { MaChiTietCa: maChiTietCa },
  });
};

export const togglePhanCaStatus = async (maChiTietCa: string): Promise<ChiTietCaLamViec> => {
  const assigned = await prisma.chiTietCaLamViec.findUnique({
    where: { MaChiTietCa: maChiTietCa },
  });

  if (!assigned) {
    throw new NotFoundError('Không tìm thấy lịch phân ca');
  }

  const newKhaDung = !assigned.KhaDung;

  if (newKhaDung) {
    const shift = await prisma.caLamViec.findUnique({
      where: { MaCa: assigned.MaCa },
    });
    if (!shift) {
      throw new NotFoundError('Ca làm việc không tồn tại');
    }
    const count = await prisma.chiTietCaLamViec.count({
      where: {
        MaCa: assigned.MaCa,
        NgayLamViec: assigned.NgayLamViec,
        KhaDung: true,
      },
    });
    if (count >= shift.SoNguoiToiDa) {
      throw new BadRequestError('Ca làm việc trong ngày đã đủ số lượng nhân sự tối đa!');
    }
  }

  return prisma.chiTietCaLamViec.update({
    where: { MaChiTietCa: maChiTietCa },
    data: { KhaDung: newKhaDung },
    include: {
      CaLamViec: true,
      NhanVien: {
        include: {
          TaiKhoan: {
            select: {
              HoTen: true,
              Email: true,
              SoDienThoai: true,
            },
          },
        },
      },
    },
  });
};
