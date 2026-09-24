import prisma from '../../../config/prisma';
import * as staffLichLamViecRepository from './staffLichLamViec.repository';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../../utils/errors';
import { operationalSettings } from '../../operational-settings';
import { milliseconds } from '../../../shared/time';
import {
  ShiftTemplateQueryInput,
  MyScheduleQueryInput,
  RegisterShiftInput,
} from './staffLichLamViec.validator';

/**
 * Helper to combine a date portion and a time portion into a single Date object
 */
export const combineDateAndTime = (ngayLamViec: Date, timeObj: Date): Date => {
  const combined = new Date(ngayLamViec);
  combined.setHours(
    timeObj.getHours(),
    timeObj.getMinutes(),
    timeObj.getSeconds(),
    0
  );
  return combined;
};

/**
 * Retrieve active shifts, calculating capacity and vacancy counters if a date is provided
 */
export const getAvailableShifts = async (maTaiKhoan: string, query: ShiftTemplateQueryInput) => {
  // 1. Verify active staff profile
  const staff = await staffLichLamViecRepository.findStaffByAccountId(maTaiKhoan);
  if (!staff) {
    throw new ForbiddenError('Tài khoản không phải nhân viên hoặc đã bị khóa.');
  }

  const page = query.page ?? 1;
  const limit = query.limit ?? 10;
  const skip = (page - 1) * limit;

  // 2. Fetch shift templates and total count
  const templates = await staffLichLamViecRepository.findAvailableShiftTemplates(skip, limit);
  const total = await staffLichLamViecRepository.countAvailableShiftTemplates();

  // 3. Process dynamic fields if date filter is provided
  if (query.ngayLamViec) {
    // Avoid N+1 queries by querying all active registrations for the target date
    const registrations = await staffLichLamViecRepository.findRegistrationsForDate(query.ngayLamViec);
    const countMap: Record<string, number> = {};
    for (const reg of registrations) {
      countMap[reg.MaCa] = (countMap[reg.MaCa] || 0) + 1;
    }

    const shifts = templates.map((template) => {
      const soNguoiDaDangKy = countMap[template.MaCa] || 0;
      return {
        MaCa: template.MaCa,
        TenCa: template.TenCa,
        GioBatDau: template.GioBatDau,
        GioKetThuc: template.GioKetThuc,
        SoNguoiToiDa: template.SoNguoiToiDa,
        SoNguoiDaDangKy: soNguoiDaDangKy,
        ConTrong: soNguoiDaDangKy < template.SoNguoiToiDa,
      };
    });

    return {
      shifts,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  // 4. Return templates only
  const shifts = templates.map((template) => ({
    MaCa: template.MaCa,
    TenCa: template.TenCa,
    GioBatDau: template.GioBatDau,
    GioKetThuc: template.GioKetThuc,
    SoNguoiToiDa: template.SoNguoiToiDa,
  }));

  return {
    shifts,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
};

/**
 * Retrieve registered schedule for the current staff member
 */
export const getMySchedule = async (maTaiKhoan: string, query: MyScheduleQueryInput) => {
  // 1. Verify active staff profile
  const staff = await staffLichLamViecRepository.findStaffByAccountId(maTaiKhoan);
  if (!staff) {
    throw new ForbiddenError('Tài khoản không phải nhân viên hoặc đã bị khóa.');
  }

  const page = query.page ?? 1;
  const limit = query.limit ?? 10;
  const skip = (page - 1) * limit;

  // 2. Fetch schedules and total count
  const schedules = await staffLichLamViecRepository.findStaffSchedules(
    staff.MaNhanVien,
    { tuNgay: query.tuNgay, denNgay: query.denNgay },
    skip,
    limit
  );

  const total = await staffLichLamViecRepository.countStaffSchedules(
    staff.MaNhanVien,
    { tuNgay: query.tuNgay, denNgay: query.denNgay }
  );

  return {
    schedules,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
};

/**
 * Register a staff member for a specific shift and date
 */
export const registerShift = async (maTaiKhoan: string, body: RegisterShiftInput) => {
  // 1. Verify active staff profile
  const staff = await staffLichLamViecRepository.findStaffByAccountId(maTaiKhoan);
  if (!staff) {
    throw new ForbiddenError('Tài khoản không phải nhân viên hoặc đã bị khóa.');
  }

  const now = new Date();

  // 2. Date checks - must not be in the past
  const todayDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const inputDateOnly = new Date(
    body.NgayLamViec.getFullYear(),
    body.NgayLamViec.getMonth(),
    body.NgayLamViec.getDate()
  );

  if (inputDateOnly < todayDateOnly) {
    throw new BadRequestError('Không thể đăng ký ca làm việc trong quá khứ.');
  }

  // 3. Run overlap, capacity, and creation steps inside a Prisma transaction
  return prisma.$transaction(async (tx) => {
    // 3.1 Fetch shift template
    const shift = await staffLichLamViecRepository.findActiveShiftById(body.MaCa, tx);
    if (!shift) {
      throw new NotFoundError('Ca làm việc không tồn tại hoặc không khả dụng.');
    }

    // 3.2 Shift start time check (current time must be before shift start)
    const shiftStartTime = combineDateAndTime(body.NgayLamViec, shift.GioBatDau);
    if (now >= shiftStartTime) {
      throw new BadRequestError('Không thể đăng ký ca làm việc đã hoặc đang diễn ra.');
    }

    // 3.3 Capacity check
    const count = await staffLichLamViecRepository.countRegistrationsByShiftAndDate(
      body.MaCa,
      body.NgayLamViec,
      tx
    );
    if (count >= shift.SoNguoiToiDa) {
      throw new BadRequestError('Ca làm việc này đã đủ số lượng nhân viên.');
    }

    // 3.4 Duplicate registration check
    const duplicate = await staffLichLamViecRepository.findDuplicateRegistration(
      staff.MaNhanVien,
      body.MaCa,
      body.NgayLamViec,
      tx
    );
    if (duplicate) {
      throw new BadRequestError('Bạn đã đăng ký ca làm việc này rồi.');
    }

    // 3.5 Overlap check
    const overlapping = await staffLichLamViecRepository.findOverlappingRegistrations(
      staff.MaNhanVien,
      body.NgayLamViec,
      shift.GioBatDau,
      shift.GioKetThuc,
      tx
    );
    if (overlapping) {
      throw new BadRequestError('Bạn đã đăng ký một ca làm việc khác trùng giờ trong ngày này.');
    }

    // 3.6 Create registration
    return staffLichLamViecRepository.createRegistration(
      staff.MaNhanVien,
      body.MaCa,
      body.NgayLamViec,
      tx
    );
  });
};

/**
 * Cancel own registered shift (soft-delete)
 */
export const cancelShift = async (maTaiKhoan: string, maChiTietCa: string) => {
  // 1. Verify active staff profile
  const staff = await staffLichLamViecRepository.findStaffByAccountId(maTaiKhoan);
  if (!staff) {
    throw new ForbiddenError('Tài khoản không phải nhân viên hoặc đã bị khóa.');
  }

  // 2. Fetch active registration details
  const registration = await staffLichLamViecRepository.findActiveRegistrationById(maChiTietCa);
  if (!registration) {
    throw new NotFoundError('Lịch đăng ký ca làm việc không tồn tại hoặc đã bị hủy.');
  }

  // 3. Verify registration ownership
  if (registration.MaNhanVien !== staff.MaNhanVien) {
    throw new ForbiddenError('Bạn không có quyền hủy lịch đăng ký ca làm của người khác.');
  }

  // 4. Validate cancellation timeline using the current operational policy.
  const now = new Date();
  const shiftStartTime = combineDateAndTime(registration.NgayLamViec, registration.CaLamViec.GioBatDau);

  const settings = await operationalSettings.get();
  const cancellationWindow = milliseconds.hours(settings.HanHuyCaTruocGio);
  if (shiftStartTime.getTime() - now.getTime() < cancellationWindow) {
    throw new BadRequestError(
      `Chỉ có thể hủy ca làm việc trước khi ca bắt đầu ít nhất ${settings.HanHuyCaTruocGio} giờ.`,
    );
  }

  // 5. Execute cancellation (soft-delete)
  return staffLichLamViecRepository.cancelRegistration(maChiTietCa);
};
