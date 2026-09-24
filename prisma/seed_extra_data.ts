import { PrismaClient, TrangThaiGheSuatChieu, PhuongThucThanhToan, TrangThaiGiaoDich, TrangThaiPhieuDatVe } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  console.log("🎬 Seed bổ sung: Suất chiếu + Vé đã đặt cho demo...\n");

  // ========== Lookup existing metadata ==========
  const phong1 = await prisma.phongChieu.findFirst({ where: { TenPhong: "Phòng chiếu 01" }, include: { LoaiPhong: true } });
  const phong2 = await prisma.phongChieu.findFirst({ where: { TenPhong: { contains: "IMAX" } }, include: { LoaiPhong: true } });
  const lnThuong = await prisma.loaiNgay.findFirst({ where: { TenLoaiNgay: "Ngày thường" } });
  const lnCuoiTuan = await prisma.loaiNgay.findFirst({ where: { TenLoaiNgay: "Cuối tuần" } });
  const lnNgayLe = await prisma.loaiNgay.findFirst({ where: { TenLoaiNgay: "Ngày lễ" } });
  const lgThuong = await prisma.loaiGhe.findFirst({ where: { TenLoaiGhe: "Thường" } });
  const lgVIP = await prisma.loaiGhe.findFirst({ where: { TenLoaiGhe: "VIP" } });
  const lgSweetbox = await prisma.loaiGhe.findFirst({ where: { TenLoaiGhe: "Sweetbox" } });

  // Lookup customer accounts
  const customer1 = await prisma.taiKhoan.findFirst({ where: { TenDangNhap: "khachhang01" }, include: { KhachHang: true } });
  
  // Lookup staff
  const staff = await prisma.taiKhoan.findFirst({ where: { TenDangNhap: "nhanvien01" }, include: { NhanVien: true } });

  if (!phong1 || !phong2 || !lnThuong || !lnCuoiTuan || !lgThuong || !lgVIP || !lgSweetbox || !customer1?.KhachHang) {
    console.error("❌ Thiếu dữ liệu nền. Hãy chạy prisma:seed trước.");
    return;
  }

  // ========== Lookup all movies ==========
  const parasite = await prisma.phim.findFirst({ where: { TenPhim: "Parasite" } });
  const spiritedAway = await prisma.phim.findFirst({ where: { TenPhim: "Spirited Away" } });
  const avengers = await prisma.phim.findFirst({ where: { TenPhim: "Avengers: Endgame" } });
  const dune = await prisma.phim.findFirst({ where: { TenPhim: "Dune: Part Two" } });
  const insideOut = await prisma.phim.findFirst({ where: { TenPhim: "Inside Out 2" } });
  const inception = await prisma.phim.findFirst({ where: { TenPhim: "Inception" } });
  const lionKing = await prisma.phim.findFirst({ where: { TenPhim: "The Lion King" } });
  const joker = await prisma.phim.findFirst({ where: { TenPhim: "Joker" } });
  const spiderman = await prisma.phim.findFirst({ where: { TenPhim: "Spider-Man: No Way Home" } });
  const interstellar = await prisma.phim.findFirst({ where: { TenPhim: "Interstellar" } });

  if (!parasite || !spiritedAway || !avengers || !dune || !insideOut || !inception) {
    console.error("❌ Thiếu phim. Hãy chạy prisma:seed trước.");
    return;
  }

  // ========== Create additional customer accounts for realistic data ==========
  const hashedPassword = "$2b$10$LJ3m4iQ3nfR5p5r5r5r5rOk5r5r5r5r5r5r5r5r5r5r5r5r5r5"; // placeholder
  
  // We'll use bcrypt properly
  const bcrypt = await import("bcrypt");
  const hash = await bcrypt.hash("123456", 10);

  // Create extra customers
  const extraCustomers: any[] = [];
  const customerData = [
    { TenDangNhap: "khachhang02", HoTen: "Nguyễn Văn An", Email: "nguyenvanan@gmail.com", SoDienThoai: "0912345678", GioiTinh: true, NgaySinh: new Date("1998-05-15") },
    { TenDangNhap: "khachhang03", HoTen: "Lê Thị Mai", Email: "lethimai@gmail.com", SoDienThoai: "0923456789", GioiTinh: false, NgaySinh: new Date("2001-08-22") },
    { TenDangNhap: "khachhang04", HoTen: "Phạm Đức Hùng", Email: "phamhung@gmail.com", SoDienThoai: "0934567890", GioiTinh: true, NgaySinh: new Date("1995-12-03") },
    { TenDangNhap: "khachhang05", HoTen: "Trương Hoàng Yến", Email: "truongyen@gmail.com", SoDienThoai: "0945678901", GioiTinh: false, NgaySinh: new Date("2000-02-14") },
    { TenDangNhap: "khachhang06", HoTen: "Đỗ Minh Tuấn", Email: "dominhtuan@gmail.com", SoDienThoai: "0956789012", GioiTinh: true, NgaySinh: new Date("1997-07-30") },
  ];

  for (const c of customerData) {
    let tk = await prisma.taiKhoan.findUnique({ where: { TenDangNhap: c.TenDangNhap } });
    if (!tk) {
      tk = await prisma.taiKhoan.create({
        data: {
          TenDangNhap: c.TenDangNhap,
          MatKhau: hash,
          HoTen: c.HoTen,
          Email: c.Email,
          SoDienThoai: c.SoDienThoai,
          GioiTinh: c.GioiTinh,
          NgaySinh: c.NgaySinh,
          VaiTro: "CUSTOMER",
          KhaDung: true,
          KhachHang: { create: { KhaDung: true } },
        },
        include: { KhachHang: true },
      });
      console.log(`✅ Đã tạo khách hàng: ${c.HoTen}`);
    } else {
      const existing = await prisma.taiKhoan.findUnique({ where: { TenDangNhap: c.TenDangNhap }, include: { KhachHang: true } });
      extraCustomers.push(existing);
      continue;
    }
    extraCustomers.push(tk);
  }

  // Include original customer
  const allCustomers = [customer1, ...extraCustomers].filter(c => c?.KhachHang);

  // ========== Helper: tạo suất chiếu + ghế ==========
  async function createShowtime(maPhim: string, maPhong: string, maLoaiNgay: string, ngay: string, gio: string, gia: number) {
    // Check if a showtime already exists at this exact time/room/date
    // Use date range for NgayChieu to handle timezone issues with @db.Date
    const targetDate = new Date(ngay);
    const startOfDay = new Date(targetDate);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setUTCDate(startOfDay.getUTCDate() + 1);

    const existing = await prisma.suatChieu.findFirst({
      where: {
        MaPhim: maPhim,
        MaPhong: maPhong,
        NgayChieu: { gte: startOfDay, lt: endOfDay },
        GioChieu: new Date(`1970-01-01T${gio}:00Z`),
      }
    });
    if (existing) {
      console.log(`  ℹ️ Suất chiếu ${ngay} ${gio} đã tồn tại, bỏ qua.`);
      return existing;
    }

    const ghes = await prisma.ghe.findMany({ where: { MaPhong: maPhong, KhaDung: true }, include: { LoaiGhe: true } });
    const phong = await prisma.phongChieu.findUnique({ where: { MaPhong: maPhong }, include: { LoaiPhong: true } });
    const loaiNgay = await prisma.loaiNgay.findUnique({ where: { MaLoaiNgay: maLoaiNgay } });

    const sc = await prisma.suatChieu.create({
      data: {
        MaPhim: maPhim, MaPhong: maPhong, MaLoaiNgay: maLoaiNgay,
        NgayChieu: new Date(ngay), GioChieu: new Date(`1970-01-01T${gio}:00Z`),
        GiaVeGoc: gia, KhaDung: true,
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
  async function sellTickets(
    maSuatChieu: string,
    seatCount: number,
    customerTK: any,
    phuongThuc: PhuongThucThanhToan = "PAYOS",
    ngayDat?: Date,
    isStaffSale: boolean = false,
  ) {
    const seats = await prisma.gheSuatChieu.findMany({
      where: { MaSuatChieu: maSuatChieu, TrangThai: "TRONG" },
      take: seatCount,
    });

    if (seats.length === 0) {
      console.log(`  ⚠️ Hết ghế trống cho suất chiếu ${maSuatChieu}`);
      return null;
    }

    let total = 0;
    for (const s of seats) {
      await prisma.gheSuatChieu.update({
        where: { MaGheSuatChieu: s.MaGheSuatChieu },
        data: { TrangThai: "DA_DAT" },
      });
      total += Number(s.GiaVe);
    }

    const phieuData: any = {
      TongTien: total,
      TrangThai: TrangThaiPhieuDatVe.DA_THANH_TOAN,
      ChiTietDatVes: {
        create: seats.map(s => ({ MaGheSuatChieu: s.MaGheSuatChieu, GiaVe: s.GiaVe })),
      },
    };

    if (isStaffSale && staff?.NhanVien) {
      phieuData.MaNhanVien = staff.NhanVien.MaNhanVien;
    } else {
      phieuData.MaKhachHang = customerTK.KhachHang.MaKhachHang;
    }

    const phieu = await prisma.phieuDatVe.create({ data: phieuData });

    // Update NgayTao if custom date provided
    if (ngayDat) {
      await prisma.phieuDatVe.update({
        where: { MaPhieuDat: phieu.MaPhieuDat },
        data: { NgayTao: ngayDat },
      });
    }

    await prisma.giaoDich.create({
      data: {
        MaPhieuDat: phieu.MaPhieuDat,
        PhuongThuc: phuongThuc,
        SoTien: total,
        TrangThai: TrangThaiGiaoDich.THANH_CONG,
        NgayGiaoDich: ngayDat || new Date(),
      },
    });

    return { phieu, seats, total };
  }

  // ==============================================================
  // 1. TẠO SUẤT CHIẾU CHO PARASITE (ĐANG CHIẾU, KHÔNG CÓ SUẤT)
  // ==============================================================
  console.log("\n📽️ === PARASITE (đang chiếu 15/05 - 15/07) ===");
  
  const parasiteShowtimes = [
    // Quá khứ gần (có vé đã bán - cho thống kê)
    { phong: phong1, loaiNgay: lnThuong, ngay: "2026-05-20", gio: "10:00", gia: 75000 },
    { phong: phong2, loaiNgay: lnThuong, ngay: "2026-05-21", gio: "14:00", gia: 85000 },
    { phong: phong1, loaiNgay: lnCuoiTuan, ngay: "2026-05-24", gio: "19:30", gia: 80000 },
    { phong: phong2, loaiNgay: lnCuoiTuan, ngay: "2026-05-25", gio: "20:00", gia: 90000 },
    { phong: phong1, loaiNgay: lnThuong, ngay: "2026-05-27", gio: "15:00", gia: 75000 },
    { phong: phong1, loaiNgay: lnThuong, ngay: "2026-05-28", gio: "10:30", gia: 75000 },
    // Hôm nay và tương lai gần (cho demo đặt vé)
    { phong: phong1, loaiNgay: lnThuong, ngay: "2026-05-30", gio: "09:00", gia: 75000 },
    { phong: phong2, loaiNgay: lnCuoiTuan, ngay: "2026-05-31", gio: "14:30", gia: 90000 },
    { phong: phong1, loaiNgay: lnCuoiTuan, ngay: "2026-05-31", gio: "19:00", gia: 80000 },
    { phong: phong2, loaiNgay: lnThuong, ngay: "2026-06-01", gio: "20:00", gia: 85000 },
    { phong: phong1, loaiNgay: lnThuong, ngay: "2026-06-02", gio: "10:00", gia: 75000 },
    { phong: phong1, loaiNgay: lnThuong, ngay: "2026-06-03", gio: "14:00", gia: 75000 },
  ];

  const parasiteSCs: any[] = [];
  for (const item of parasiteShowtimes) {
    const sc = await createShowtime(parasite!.MaPhim, item.phong.MaPhong, item.loaiNgay.MaLoaiNgay, item.ngay, item.gio, item.gia);
    parasiteSCs.push(sc);
    console.log(`  ✅ Suất chiếu: ${item.ngay} ${item.gio} - ${item.phong.TenPhong}`);
  }

  // ==============================================================
  // 2. TẠO SUẤT CHIẾU CHO SPIRITED AWAY (ĐANG CHIẾU, KHÔNG CÓ SUẤT)
  // ==============================================================
  console.log("\n📽️ === SPIRITED AWAY (đang chiếu từ 01/01) ===");

  const spiritedShowtimes = [
    // Quá khứ gần
    { phong: phong1, loaiNgay: lnThuong, ngay: "2026-05-19", gio: "10:00", gia: 65000 },
    { phong: phong1, loaiNgay: lnThuong, ngay: "2026-05-22", gio: "14:00", gia: 65000 },
    { phong: phong2, loaiNgay: lnCuoiTuan, ngay: "2026-05-24", gio: "16:00", gia: 80000 },
    { phong: phong1, loaiNgay: lnThuong, ngay: "2026-05-26", gio: "10:00", gia: 65000 },
    { phong: phong2, loaiNgay: lnThuong, ngay: "2026-05-29", gio: "19:00", gia: 80000 },
    // Hôm nay và tương lai
    { phong: phong1, loaiNgay: lnThuong, ngay: "2026-05-30", gio: "14:00", gia: 65000 },
    { phong: phong2, loaiNgay: lnCuoiTuan, ngay: "2026-05-31", gio: "10:00", gia: 80000 },
    { phong: phong1, loaiNgay: lnCuoiTuan, ngay: "2026-05-31", gio: "16:30", gia: 70000 },
    { phong: phong1, loaiNgay: lnThuong, ngay: "2026-06-01", gio: "09:30", gia: 65000 },
    { phong: phong2, loaiNgay: lnThuong, ngay: "2026-06-02", gio: "14:00", gia: 80000 },
    { phong: phong1, loaiNgay: lnThuong, ngay: "2026-06-04", gio: "10:00", gia: 65000 },
  ];

  const spiritedSCs: any[] = [];
  for (const item of spiritedShowtimes) {
    const sc = await createShowtime(spiritedAway!.MaPhim, item.phong.MaPhong, item.loaiNgay.MaLoaiNgay, item.ngay, item.gio, item.gia);
    spiritedSCs.push(sc);
    console.log(`  ✅ Suất chiếu: ${item.ngay} ${item.gio} - ${item.phong.TenPhong}`);
  }

  // ==============================================================
  // 3. THÊM SUẤT CHIẾU CHO AVENGERS (ĐANG CHIẾU)
  // ==============================================================
  console.log("\n📽️ === AVENGERS: ENDGAME (thêm suất chiếu) ===");

  const avengersExtraShowtimes = [
    { phong: phong1, loaiNgay: lnThuong, ngay: "2026-05-18", gio: "10:00", gia: 80000 },
    { phong: phong2, loaiNgay: lnThuong, ngay: "2026-05-19", gio: "19:00", gia: 95000 },
    { phong: phong1, loaiNgay: lnThuong, ngay: "2026-05-23", gio: "14:30", gia: 80000 },
    { phong: phong2, loaiNgay: lnCuoiTuan, ngay: "2026-05-25", gio: "16:00", gia: 95000 },
    { phong: phong1, loaiNgay: lnThuong, ngay: "2026-05-27", gio: "20:00", gia: 80000 },
    { phong: phong1, loaiNgay: lnThuong, ngay: "2026-05-29", gio: "10:00", gia: 80000 },
    // Tương lai
    { phong: phong1, loaiNgay: lnThuong, ngay: "2026-05-30", gio: "19:30", gia: 80000 },
    { phong: phong2, loaiNgay: lnCuoiTuan, ngay: "2026-05-31", gio: "20:30", gia: 95000 },
    { phong: phong1, loaiNgay: lnThuong, ngay: "2026-06-02", gio: "14:00", gia: 80000 },
    { phong: phong2, loaiNgay: lnThuong, ngay: "2026-06-03", gio: "19:00", gia: 95000 },
  ];

  const avengersSCs: any[] = [];
  for (const item of avengersExtraShowtimes) {
    const sc = await createShowtime(avengers!.MaPhim, item.phong.MaPhong, item.loaiNgay.MaLoaiNgay, item.ngay, item.gio, item.gia);
    avengersSCs.push(sc);
    console.log(`  ✅ Suất chiếu: ${item.ngay} ${item.gio} - ${item.phong.TenPhong}`);
  }

  // ==============================================================
  // 4. THÊM SUẤT CHIẾU CHO DUNE (SẮP KẾT THÚC 30/05)
  // ==============================================================
  console.log("\n📽️ === DUNE: PART TWO (sắp kết thúc) ===");

  const duneExtraShowtimes = [
    { phong: phong1, loaiNgay: lnThuong, ngay: "2026-05-17", gio: "10:00", gia: 85000 },
    { phong: phong2, loaiNgay: lnCuoiTuan, ngay: "2026-05-18", gio: "15:00", gia: 95000 },
    { phong: phong1, loaiNgay: lnThuong, ngay: "2026-05-20", gio: "19:00", gia: 85000 },
    { phong: phong2, loaiNgay: lnThuong, ngay: "2026-05-22", gio: "20:00", gia: 95000 },
    { phong: phong1, loaiNgay: lnCuoiTuan, ngay: "2026-05-24", gio: "14:00", gia: 85000 },
    { phong: phong1, loaiNgay: lnThuong, ngay: "2026-05-26", gio: "10:00", gia: 85000 },
    { phong: phong2, loaiNgay: lnThuong, ngay: "2026-05-28", gio: "14:30", gia: 95000 },
    { phong: phong1, loaiNgay: lnThuong, ngay: "2026-05-30", gio: "16:00", gia: 85000 },
  ];

  const duneSCs: any[] = [];
  for (const item of duneExtraShowtimes) {
    const sc = await createShowtime(dune!.MaPhim, item.phong.MaPhong, item.loaiNgay.MaLoaiNgay, item.ngay, item.gio, item.gia);
    duneSCs.push(sc);
    console.log(`  ✅ Suất chiếu: ${item.ngay} ${item.gio} - ${item.phong.TenPhong}`);
  }

  // ==============================================================
  // 5. TẠO VÉ ĐÃ ĐẶT (REALISTIC DATA CHO DASHBOARD THỐNG KÊ)
  // ==============================================================
  console.log("\n🎟️ === TẠO VÉ ĐÃ ĐẶT CHO CÁC SUẤT CHIẾU QUÁ KHỨ ===");

  // Helper to get a random customer
  const getRandomCustomer = () => allCustomers[Math.floor(Math.random() * allCustomers.length)];
  const paymentMethods: PhuongThucThanhToan[] = ["PAYOS", "TIEN_MAT", "PAYOS", "PAYOS", "TIEN_MAT"];

  let totalTicketsSold = 0;
  let totalRevenue = 0;

  // --- Parasite tickets (quá khứ) ---
  console.log("\n  🎬 Parasite - bán vé các suất quá khứ:");
  for (let i = 0; i < 6; i++) { // First 6 showtimes are in the past
    const sc = parasiteSCs[i];
    if (!sc) continue;
    
    // Sell 3-8 tickets per showtime
    const ticketCounts = [5, 4, 7, 6, 3, 8];
    const count = ticketCounts[i] || 4;
    
    const saleDate = new Date(2026, 4, 17 + i, 10 + i, 30, 0); // Month is 0-indexed
    const result = await sellTickets(
      sc.MaSuatChieu,
      count,
      getRandomCustomer(),
      paymentMethods[i % paymentMethods.length],
      saleDate,
    );
    if (result) {
      totalTicketsSold += result.seats.length;
      totalRevenue += result.total;
      console.log(`    ✅ Suất ${parasiteShowtimes[i].ngay}: ${result.seats.length} vé, ${result.total.toLocaleString()}đ`);
    }

    // Sell a second batch from different customer for some showtimes
    if (i % 2 === 0) {
      const saleDate2 = new Date(2026, 4, 17 + i, 12 + i, 0, 0);
      const result2 = await sellTickets(
        sc.MaSuatChieu,
        2,
        getRandomCustomer(),
        "PAYOS",
        saleDate2,
      );
      if (result2) {
        totalTicketsSold += result2.seats.length;
        totalRevenue += result2.total;
        console.log(`    ✅ Suất ${parasiteShowtimes[i].ngay}: thêm ${result2.seats.length} vé, ${result2.total.toLocaleString()}đ`);
      }
    }
  }

  // --- Spirited Away tickets (quá khứ) ---
  console.log("\n  🎬 Spirited Away - bán vé các suất quá khứ:");
  for (let i = 0; i < 5; i++) {
    const sc = spiritedSCs[i];
    if (!sc) continue;

    const ticketCounts = [6, 3, 8, 4, 5];
    const count = ticketCounts[i] || 4;

    const saleDate = new Date(2026, 4, 19 + i, 9 + i, 15, 0);
    const result = await sellTickets(
      sc.MaSuatChieu,
      count,
      getRandomCustomer(),
      paymentMethods[i % paymentMethods.length],
      saleDate,
    );
    if (result) {
      totalTicketsSold += result.seats.length;
      totalRevenue += result.total;
      console.log(`    ✅ Suất ${spiritedShowtimes[i].ngay}: ${result.seats.length} vé, ${result.total.toLocaleString()}đ`);
    }

    if (i < 3) {
      const saleDate2 = new Date(2026, 4, 19 + i, 14 + i, 0, 0);
      const result2 = await sellTickets(
        sc.MaSuatChieu,
        3,
        getRandomCustomer(),
        "TIEN_MAT",
        saleDate2,
        true, // Staff sale
      );
      if (result2) {
        totalTicketsSold += result2.seats.length;
        totalRevenue += result2.total;
        console.log(`    ✅ Suất ${spiritedShowtimes[i].ngay}: thêm ${result2.seats.length} vé (staff), ${result2.total.toLocaleString()}đ`);
      }
    }
  }

  // --- Avengers tickets (quá khứ) ---
  console.log("\n  🎬 Avengers: Endgame - bán vé các suất quá khứ:");
  for (let i = 0; i < 6; i++) {
    const sc = avengersSCs[i];
    if (!sc) continue;

    const ticketCounts = [8, 5, 6, 10, 4, 7];
    const count = ticketCounts[i] || 5;

    const saleDate = new Date(2026, 4, 18 + i, 8 + i, 0, 0);
    const result = await sellTickets(
      sc.MaSuatChieu,
      count,
      getRandomCustomer(),
      paymentMethods[i % paymentMethods.length],
      saleDate,
    );
    if (result) {
      totalTicketsSold += result.seats.length;
      totalRevenue += result.total;
      console.log(`    ✅ Suất ${avengersExtraShowtimes[i].ngay}: ${result.seats.length} vé, ${result.total.toLocaleString()}đ`);
    }

    // More tickets from different customers
    if (i % 2 === 1) {
      const saleDate2 = new Date(2026, 4, 18 + i, 15 + i, 30, 0);
      const result2 = await sellTickets(
        sc.MaSuatChieu,
        4,
        getRandomCustomer(),
        "PAYOS",
        saleDate2,
      );
      if (result2) {
        totalTicketsSold += result2.seats.length;
        totalRevenue += result2.total;
        console.log(`    ✅ Suất ${avengersExtraShowtimes[i].ngay}: thêm ${result2.seats.length} vé, ${result2.total.toLocaleString()}đ`);
      }
    }
  }

  // --- Dune tickets (quá khứ) ---
  console.log("\n  🎬 Dune: Part Two - bán vé các suất quá khứ:");
  for (let i = 0; i < 7; i++) {
    const sc = duneSCs[i];
    if (!sc) continue;

    const ticketCounts = [6, 7, 5, 9, 4, 3, 8];
    const count = ticketCounts[i] || 5;

    const saleDate = new Date(2026, 4, 17 + i, 10 + i, 0, 0);
    const result = await sellTickets(
      sc.MaSuatChieu,
      count,
      getRandomCustomer(),
      paymentMethods[i % paymentMethods.length],
      saleDate,
    );
    if (result) {
      totalTicketsSold += result.seats.length;
      totalRevenue += result.total;
      console.log(`    ✅ Suất ${duneExtraShowtimes[i].ngay}: ${result.seats.length} vé, ${result.total.toLocaleString()}đ`);
    }

    // Staff sale for some
    if (i >= 3) {
      const saleDate2 = new Date(2026, 4, 17 + i, 16, 0, 0);
      const result2 = await sellTickets(
        sc.MaSuatChieu,
        2,
        getRandomCustomer(),
        "TIEN_MAT",
        saleDate2,
        true,
      );
      if (result2) {
        totalTicketsSold += result2.seats.length;
        totalRevenue += result2.total;
        console.log(`    ✅ Suất ${duneExtraShowtimes[i].ngay}: thêm ${result2.seats.length} vé (staff), ${result2.total.toLocaleString()}đ`);
      }
    }
  }

  // ==============================================================
  // 6. TẠO MỘT SỐ VÉ ĐÃ HỦY (cho demo trạng thái)
  // ==============================================================
  console.log("\n🚫 === TẠO VÉ ĐÃ HỦY ===");
  
  // Pick a showtime with available seats
  if (parasiteSCs[6]) {
    const cancelSeats = await prisma.gheSuatChieu.findMany({
      where: { MaSuatChieu: parasiteSCs[6].MaSuatChieu, TrangThai: "TRONG" },
      take: 2,
    });
    if (cancelSeats.length >= 2) {
      let cancelTotal = 0;
      for (const s of cancelSeats) {
        cancelTotal += Number(s.GiaVe);
      }
      const cancelPhieu = await prisma.phieuDatVe.create({
        data: {
          MaKhachHang: allCustomers[1]?.KhachHang?.MaKhachHang || customer1!.KhachHang!.MaKhachHang,
          TongTien: cancelTotal,
          TrangThai: TrangThaiPhieuDatVe.DA_HUY,
          ChiTietDatVes: {
            create: cancelSeats.map(s => ({ MaGheSuatChieu: s.MaGheSuatChieu, GiaVe: s.GiaVe })),
          },
        },
      });
      await prisma.giaoDich.create({
        data: {
          MaPhieuDat: cancelPhieu.MaPhieuDat,
          PhuongThuc: "PAYOS",
          SoTien: cancelTotal,
          TrangThai: TrangThaiGiaoDich.THAT_BAI,
        },
      });
      console.log(`  ✅ Tạo 1 phiếu đặt vé đã hủy: ${cancelTotal.toLocaleString()}đ`);
    }
  }

  // ==============================================================
  // 7. TẠO VÉ CHỜ THANH TOÁN (cho demo)
  // ==============================================================
  console.log("\n⏳ === TẠO VÉ CHỜ THANH TOÁN ===");
  
  if (parasiteSCs[7]) {
    const pendingSeats = await prisma.gheSuatChieu.findMany({
      where: { MaSuatChieu: parasiteSCs[7].MaSuatChieu, TrangThai: "TRONG" },
      take: 3,
    });
    if (pendingSeats.length >= 3) {
      let pendingTotal = 0;
      for (const s of pendingSeats) {
        await prisma.gheSuatChieu.update({
          where: { MaGheSuatChieu: s.MaGheSuatChieu },
          data: { TrangThai: "DANG_GIU", MaTaiKhoanGiu: customer1!.MaTaiKhoan, ThoiGianGiuGhe: new Date() },
        });
        pendingTotal += Number(s.GiaVe);
      }
      const pendingPhieu = await prisma.phieuDatVe.create({
        data: {
          MaKhachHang: customer1!.KhachHang!.MaKhachHang,
          TongTien: pendingTotal,
          TrangThai: TrangThaiPhieuDatVe.CHO_THANH_TOAN,
          ChiTietDatVes: {
            create: pendingSeats.map(s => ({ MaGheSuatChieu: s.MaGheSuatChieu, GiaVe: s.GiaVe })),
          },
        },
      });
      console.log(`  ✅ Tạo 1 phiếu chờ thanh toán: ${pendingTotal.toLocaleString()}đ (3 ghế)`);
    }
  }

  // ==============================================================
  // SUMMARY
  // ==============================================================
  console.log("\n" + "=".repeat(60));
  console.log("✨ SEED BỔ SUNG HOÀN TẤT!");
  console.log("=".repeat(60));
  console.log(`📊 Tổng vé đã bán:    ${totalTicketsSold} vé`);
  console.log(`💰 Tổng doanh thu:     ${totalRevenue.toLocaleString()}đ`);
  console.log(`📽️ Suất chiếu Parasite:      ${parasiteSCs.length}`);
  console.log(`📽️ Suất chiếu Spirited Away: ${spiritedSCs.length}`);
  console.log(`📽️ Suất chiếu Avengers thêm: ${avengersSCs.length}`);
  console.log(`📽️ Suất chiếu Dune thêm:     ${duneSCs.length}`);
  console.log(`👥 Khách hàng mới:     ${customerData.length}`);
  console.log("\n📋 Tài khoản khách hàng mới:");
  for (const c of customerData) {
    console.log(`   ${c.HoTen} - TenDangNhap: ${c.TenDangNhap} | MatKhau: 123456`);
  }
}

main()
  .catch(e => { console.error("❌ Lỗi:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
