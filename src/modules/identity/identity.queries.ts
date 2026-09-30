import prisma from '../../config/prisma';

const findCustomerByAccountId = (maTaiKhoan: string) =>
  prisma.khachHang.findUnique({ where: { MaTaiKhoan: maTaiKhoan } });

export const identityQueries = {
  findCustomerByAccountId,
};
