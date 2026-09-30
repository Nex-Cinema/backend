import { Router } from 'express';
import * as controller from './suatchieu.controller';
import { validate } from '../../../middlewares/validate.middleware';
import { createSuatChieuSchema, updateSuatChieuSchema } from './suatchieu.validator';

const router = Router();

router.get('/', controller.getDanhSachSuatChieu);
router.get('/:maSuatChieu', controller.getChiTietSuatChieu);
router.post('/', validate(createSuatChieuSchema), controller.taoSuatChieu);
router.put('/:maSuatChieu', validate(updateSuatChieuSchema), controller.capNhatSuatChieu);
router.delete('/:maSuatChieu', controller.xoaSuatChieu);
router.get('/:maSuatChieu/ghe', controller.getDanhSachGheSuatChieu);

export default router;
