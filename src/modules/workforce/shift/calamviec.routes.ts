import { Router } from 'express';
import * as controller from './calamviec.controller';
import { validate } from '../../../middlewares/validate.middleware';
import {
  createCaLamViecSchema,
  updateCaLamViecSchema,
  phanCaSchema,
  lichTrucQuerySchema,
} from './calamviec.validator';

const router = Router();

/**
 * @route   POST /api/v1/admin/ca-lam-viec
 * @desc    Tạo mới một ca làm việc mẫu
 * @access  Private - ADMIN only
 */
router.post(
  '/',
  validate(createCaLamViecSchema),
  controller.createCaLamViec,
);

/**
 * @route   GET /api/v1/admin/ca-lam-viec
 * @desc    Lấy danh sách các ca làm việc mẫu
 * @access  Private - ADMIN only
 */
router.get('/', controller.getDanhSachCaLamViec);

/**
 * @route   GET /api/v1/admin/ca-lam-viec/:maCa
 * @desc    Xem chi tiết một ca làm việc mẫu
 * @access  Private - ADMIN only
 */
router.get('/:maCa', controller.getChiTietCaLamViec);

/**
 * @route   PUT /api/v1/admin/ca-lam-viec/:maCa
 * @desc    Cập nhật thông tin ca làm việc mẫu
 * @access  Private - ADMIN only
 */
router.put(
  '/:maCa',
  validate(updateCaLamViecSchema),
  controller.updateCaLamViec,
);

/**
 * @route   DELETE /api/v1/admin/ca-lam-viec/:maCa
 * @desc    Xóa ca mẫu (xóa cứng nếu chưa phân lịch, xóa mềm nếu đã có lịch trực)
 * @access  Private - ADMIN only
 */
router.delete('/:maCa', controller.deleteCaLamViec);

/**
 * @route   POST /api/v1/admin/ca-lam-viec/phan-ca
 * @desc    Phân lịch trực cho một nhân viên vào ca trực cụ thể
 * @access  Private - ADMIN only
 */
router.post(
  '/phan-ca',
  validate(phanCaSchema),
  controller.phanCaLamViec,
);

/**
 * @route   GET /api/v1/admin/ca-lam-viec/phan-ca/lich-truc
 * @desc    Tra cứu lịch trực (lọc theo ngày, nhân viên, ca làm việc)
 * @access  Private - ADMIN only
 */
router.get(
  '/phan-ca/lich-truc',
  validate(lichTrucQuerySchema, 'query'),
  controller.getLichTruc,
);

/**
 * @route   DELETE /api/v1/admin/ca-lam-viec/phan-ca/:maChiTietCa
 * @desc    Hủy phân lịch trực
 * @access  Private - ADMIN only
 */
router.delete('/phan-ca/:maChiTietCa', controller.huyPhanCa);

/**
 * @route   PATCH /api/v1/admin/ca-lam-viec/phan-ca/:maChiTietCa/toggle
 * @desc    Bật/tắt trạng thái phân lịch trực
 * @access  Private - ADMIN only
 */
router.patch('/phan-ca/:maChiTietCa/toggle', controller.togglePhanCaStatus);

export default router;
