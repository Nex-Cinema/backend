import { PrismaClient, TrangThaiGheSuatChieu } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  console.log("🎬 Seed dữ liệu test Suất Chiếu (Showtime Edge Cases)...\n");

  // ========== Lookup existing metadata ==========
  const phong1 = await prisma.phongChieu.findFirst({ where: { TenPhong: "Phòng chiếu 01" }, include: { LoaiPhong: true } });
  const phong2 = await prisma.phongChieu.findFirst({ where: { TenPhong: { contains: "IMAX" } }, include: { LoaiPhong: true } });
  const lnThuong = await prisma.loaiNgay.findFirst({ where: { TenLoaiNgay: "Ngày thường" } });
  const lnCuoiTuan = await prisma.loaiNgay.findFirst({ where: { TenLoaiNgay: "Cuối tuần" } });
  const lgThuong = await prisma.loaiGhe.findFirst({ where: { TenLoaiGhe: "Thường" } });
  const lgVIP = await prisma.loaiGhe.findFirst({ where: { TenLoaiGhe: "VIP" } });
  const lgSweetbox = await prisma.loaiGhe.findFirst({ where: { TenLoaiGhe: "Sweetbox" } });
  const customer = await prisma.taiKhoan.findFirst({ where: { TenDangNhap: "khachhang01" }, include: { KhachHang: true } });

  if (!phong1 || !phong2 || !lnThuong || !lnCuoiTuan || !lgThuong || !customer?.KhachHang) {
    console.error("❌ Thiếu dữ liệu nền. Hãy chạy prisma:seed trước."); return;
  }

  // ========== Helper: tạo suất chiếu + ghế ==========
  async function createShowtime(maPhim: string, maPhong: string, maLoaiNgay: string, ngay: string, gio: string, gia: number, khaDung = true) {
    const ghes = await prisma.ghe.findMany({ where: { MaPhong: maPhong, KhaDung: true }, include: { LoaiGhe: true } });
    const phong = await prisma.phongChieu.findUnique({ where: { MaPhong: maPhong }, include: { LoaiPhong: true } });
    const loaiNgay = await prisma.loaiNgay.findUnique({ where: { MaLoaiNgay: maLoaiNgay } });

    const sc = await prisma.suatChieu.create({
      data: {
        MaPhim: maPhim, MaPhong: maPhong, MaLoaiNgay: maLoaiNgay,
        NgayChieu: new Date(ngay), GioChieu: new Date(`1970-01-01T${gio}:00Z`),
        GiaVeGoc: gia, KhaDung: khaDung,
      },
    });

    const phuThuPhong = Number(phong!.LoaiPhong.PhuThu);
    const phuThuNgay = Number(loaiNgay!.PhuThu);
    const gscData = ghes.map(g => ({
      MaSuatChieu: sc.MaSuatChieu, MaGhe: g.MaGhe,
      TrangThai: TrangThaiGheSuatChieu.TRONG,
      GiaVe: gia + phuThuPhong + Number(g.LoaiGhe.PhuThu) + phuThuNgay,
    }));
    if (gscData.length > 0) await prisma.gheSuatChieu.createMany({ data: gscData });
    return sc;
  }

  // ========== Helper: bán vé giả lập ==========
  async function sellTicket(maSuatChieu: string, seatCount: number) {
    const seats = await prisma.gheSuatChieu.findMany({
      where: { MaSuatChieu: maSuatChieu, TrangThai: "TRONG" }, take: seatCount,
    });
    let total = 0;
    for (const s of seats) {
      await prisma.gheSuatChieu.update({ where: { MaGheSuatChieu: s.MaGheSuatChieu }, data: { TrangThai: "DA_DAT" } });
      total += Number(s.GiaVe);
    }
    const phieu = await prisma.phieuDatVe.create({
      data: {
        MaKhachHang: customer!.KhachHang!.MaKhachHang, TongTien: total, TrangThai: "DA_THANH_TOAN",
        ChiTietDatVes: { create: seats.map(s => ({ MaGheSuatChieu: s.MaGheSuatChieu, GiaVe: s.GiaVe })) },
      },
    });
    await prisma.giaoDich.create({
      data: { MaPhieuDat: phieu.MaPhieuDat, PhuongThuc: "PAYOS", SoTien: total, TrangThai: "THANH_CONG" },
    });
    return phieu;
  }

  // ========== PHIM cho test ==========
  // Phim A: đang chiếu (01/06 - 30/06) - dùng test overlap, update, delete
  let phimA = await prisma.phim.findFirst({ where: { TenPhim: "Avengers: Endgame" } });

  // Phim B: chưa khởi chiếu (01/07 - 01/09) - dùng test release window
  let phimB = await prisma.phim.findFirst({ where: { TenPhim: "The Lion King" } });

  // Phim C: đã kết thúc (01/03 - 30/05) - dùng test release window quá hạn
  let phimC = await prisma.phim.findFirst({ where: { TenPhim: "Dune: Part Two" } });

  if (!phimA || !phimB || !phimC) { console.error("❌ Thiếu phim. Hãy chạy prisma:seed trước."); return; }

  console.log("--- CASE 1.1: Trùng lịch phòng chiếu (Overlapping) ---");
  // Tạo suất chiếu 08:00 - ~11:01 (phim 181 phút) tại Phòng 1 ngày 2026-06-20
  const scOverlapBase = await createShowtime(phimA.MaPhim, phong1.MaPhong, lnThuong.MaLoaiNgay, "2026-06-20", "08:00", 70000);
  console.log(`✅ Suất gốc: Phòng 1, 2026-06-20 08:00 (Avengers 181p -> kết thúc ~11:01)`);
  console.log(`   ➡ Test: Thử tạo suất MỚI tại Phòng 1 cùng ngày lúc 09:30 hoặc 10:00 -> phải BÁO LỖI trùng`);
  console.log(`   ➡ Test: Tạo suất MỚI tại Phòng 1 cùng ngày lúc 12:00 -> phải THÀNH CÔNG\n`);

  console.log("--- CASE 1.4 & 1.5: Suất chiếu đã bán vé (chặn sửa giá/phòng/xóa) ---");
  const scWithTickets = await createShowtime(phimA.MaPhim, phong2.MaPhong, lnCuoiTuan.MaLoaiNgay, "2026-06-21", "19:00", 90000);
  const ticket = await sellTicket(scWithTickets.MaSuatChieu, 3);
  console.log(`✅ Suất: IMAX, 2026-06-21 19:00 (Avengers), đã bán 3 vé`);
  console.log(`   ➡ Test ADMIN sửa: Đổi giá vé gốc -> CHẶN`);
  console.log(`   ➡ Test ADMIN sửa: Đổi phòng chiếu -> CHẶN`);
  console.log(`   ➡ Test ADMIN sửa: Đổi loại ngày -> CHẶN`);
  console.log(`   ➡ Test ADMIN sửa: Đổi KhaDung = false -> CHO PHÉP`);
  console.log(`   ➡ Test ADMIN xóa: -> CHẶN (đã bán vé)\n`);

  console.log("--- CASE: Suất chiếu chưa bán vé (cho phép xóa/sửa thoải mái) ---");
  const scNoBuy = await createShowtime(phimA.MaPhim, phong1.MaPhong, lnThuong.MaLoaiNgay, "2026-06-22", "14:00", 75000);
  console.log(`✅ Suất: Phòng 1, 2026-06-22 14:00 (Avengers), CHƯA bán vé`);
  console.log(`   ➡ Test ADMIN sửa giá, đổi phòng -> CHO PHÉP`);
  console.log(`   ➡ Test ADMIN xóa -> CHO PHÉP\n`);

  console.log("--- CASE 2.1: Suất chiếu bị ẩn (KhaDung=false) - Client không thấy ---");
  const scHidden = await createShowtime(phimA.MaPhim, phong1.MaPhong, lnThuong.MaLoaiNgay, "2026-06-23", "10:00", 70000, false);
  console.log(`✅ Suất: Phòng 1, 2026-06-23 10:00, KhaDung=FALSE`);
  console.log(`   ➡ Test CLIENT: Suất này KHÔNG hiển thị trên trang đặt vé\n`);

  console.log("--- CASE 2.3: Dynamic Pricing (so sánh giá giữa phòng Standard vs IMAX) ---");
  const scPriceStd = await createShowtime(phimA.MaPhim, phong1.MaPhong, lnThuong.MaLoaiNgay, "2026-06-24", "15:00", 70000);
  const scPriceImax = await createShowtime(phimA.MaPhim, phong2.MaPhong, lnCuoiTuan.MaLoaiNgay, "2026-06-28", "19:00", 90000);
  console.log(`✅ Suất Standard: Phòng 1, ngày thường, giá gốc 70k`);
  console.log(`   - Ghế Thường: 70k + 0 + 0 + 0 = 70,000đ`);
  console.log(`   - Ghế VIP:    70k + 0 + 15k + 0 = 85,000đ`);
  console.log(`   - Sweetbox:   70k + 0 + 30k + 0 = 100,000đ`);
  console.log(`✅ Suất IMAX: Phòng IMAX, cuối tuần, giá gốc 90k`);
  console.log(`   - Ghế Thường: 90k + 50k + 0 + 15k = 155,000đ`);
  console.log(`   - Ghế VIP:    90k + 50k + 15k + 15k = 170,000đ`);
  console.log(`   - Sweetbox:   90k + 50k + 30k + 15k = 185,000đ`);
  console.log(`   ➡ Test CLIENT: Đối chiếu giá trên UI với giá trên\n`);

  console.log("--- CASE 2.2: Giữ ghế & Timeout (dùng suất tương lai) ---");
  const scHoldTest = await createShowtime(phimA.MaPhim, phong1.MaPhong, lnThuong.MaLoaiNgay, "2026-06-25", "18:00", 80000);
  console.log(`✅ Suất: Phòng 1, 2026-06-25 18:00 (test giữ ghế)`);
  console.log(`   ➡ Test CLIENT: Đăng nhập khachhang01, chọn ghế, đợi timeout -> ghế tự giải phóng`);
  console.log(`   ➡ Test STAFF:  Trên /staff/ban-ve, ghế đang giữ phải hiện màu vàng\n`);

  console.log("--- CASE 3.1 & 3.2: Bán vé tại quầy (Staff) ---");
  console.log(`   ➡ Dùng suất 2026-06-25 18:00 ở trên để test bán vé tại quầy`);
  console.log(`   ➡ Test: Staff chọn ghế trống -> thanh toán tiền mặt -> thành công\n`);

  console.log("--- CASE 3.3: Soát vé (Dùng vé đã bán ở case 1.4) ---");
  const chiTietVes = await prisma.chiTietDatVe.findMany({ where: { MaPhieuDat: ticket.MaPhieuDat } });
  console.log(`✅ Vé đã bán (MaPhieuDat: ${ticket.MaPhieuDat}), ${chiTietVes.length} chi tiết vé`);
  for (const ct of chiTietVes) {
    console.log(`   - MaChiTietDat: ${ct.MaChiTietDat}`);
  }
  console.log(`   ➡ Test STAFF soát vé: Quét mã MaChiTietDat lần 1 -> OK`);
  console.log(`   ➡ Test STAFF soát vé: Quét lại lần 2 -> BÁO LỖI "Đã soát"\n`);

  console.log("✨ Seed showtime test cases hoàn tất!");
  console.log("📋 Tổng hợp suất chiếu đã seed:");
  console.log(`   1. Overlap base:  ${scOverlapBase.MaSuatChieu} (Phòng 1, 2026-06-20, 08:00)`);
  console.log(`   2. Đã bán vé:    ${scWithTickets.MaSuatChieu} (IMAX, 2026-06-21, 19:00, 3 vé)`);
  console.log(`   3. Chưa bán vé:  ${scNoBuy.MaSuatChieu} (Phòng 1, 2026-06-22, 14:00)`);
  console.log(`   4. Bị ẩn:        ${scHidden.MaSuatChieu} (Phòng 1, 2026-06-23, 10:00)`);
  console.log(`   5. Giá Standard: ${scPriceStd.MaSuatChieu} (Phòng 1, 2026-06-24, 15:00)`);
  console.log(`   6. Giá IMAX:     ${scPriceImax.MaSuatChieu} (IMAX, 2026-06-28, 19:00)`);
  console.log(`   7. Hold/Staff:   ${scHoldTest.MaSuatChieu} (Phòng 1, 2026-06-25, 18:00)`);
}

main()
  .catch(e => { console.error("❌ Lỗi:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
