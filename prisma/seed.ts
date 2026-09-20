import { PrismaClient, Role, GioiHanTuoi, TrangThaiGheSuatChieu } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

const SALT_ROUNDS = 10;
const DEFAULT_PASSWORD = "123456";

const bangkokCalendarDate = (offsetInDays = 0) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const date = new Date(Date.UTC(Number(value.year), Number(value.month) - 1, Number(value.day)));
  date.setUTCDate(date.getUTCDate() + offsetInDays);
  return date;
};

async function main() {
  console.log("🌱 Bắt đầu seed dữ liệu...");

  const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);

  // Check if we already have TaiKhoan data
  const taiKhoanCount = await prisma.taiKhoan.count();
  const shouldCleanup = taiKhoanCount === 0 || process.argv.includes("--reset");

  if (shouldCleanup) {
    console.log("🗑️ Đang dọn dẹp dữ liệu cũ...");
    // Phải xóa theo đúng thứ tự ràng buộc khóa ngoại (Foreign Key Constraints)
    await prisma.chiTietDatVe.deleteMany({});
    await prisma.lichSuHoanTien.deleteMany({});
    await prisma.giaoDich.deleteMany({});
    await prisma.phieuDatVe.deleteMany({});
    await prisma.gheSuatChieu.deleteMany({});
    await prisma.suatChieu.deleteMany({});
    await prisma.danhGia.deleteMany({});
    await prisma.refreshToken.deleteMany({});
    await prisma.chiTietCaLamViec.deleteMany({});
    await prisma.nhanVien.deleteMany({});
    await prisma.khachHang.deleteMany({});
    await prisma.taiKhoan.deleteMany({});
    await prisma.ghe.deleteMany({});
    await prisma.phongChieu.deleteMany({});
    await prisma.soDoGhe.deleteMany({});
    await prisma.loaiPhong.deleteMany({});
    await prisma.loaiGhe.deleteMany({});
    await prisma.loaiNgay.deleteMany({});
    await prisma.caLamViec.deleteMany({});
    await prisma.phim.deleteMany({});
    console.log("🗑️ Đã dọn sạch database.");
  } else {
    console.log("ℹ️ Bỏ qua dọn dẹp dữ liệu cũ để đảm bảo tính lũy kế (idempotent). Dùng --reset nếu muốn xóa sạch.");
  }

  // ========================
  // Tạo/Cập nhật tài khoản Admin
  // ========================
  let adminTK = await prisma.taiKhoan.findUnique({
    where: { TenDangNhap: "admin" },
    include: { NhanVien: true }
  });
  if (!adminTK) {
    adminTK = await prisma.taiKhoan.create({
      data: {
        TenDangNhap: "admin",
        MatKhau: hashedPassword,
        HoTen: "Quản trị viên",
        Email: "admin@cinema.com",
        SoDienThoai: "0901000001",
        GioiTinh: true,
        NgaySinh: new Date("1990-01-01"),
        VaiTro: Role.ADMIN,
        KhaDung: true,
        NhanVien: {
          create: {
            ChucVu: "Quản trị hệ thống",
            KhaDung: true,
          },
        },
      },
      include: { NhanVien: true }
    });
    console.log(`✅ Đã tạo tài khoản Admin: ${adminTK.TenDangNhap}`);
  } else {
    console.log(`ℹ️ Tài khoản Admin đã tồn tại: ${adminTK.TenDangNhap}`);
  }

  // ========================
  // Tạo/Cập nhật tài khoản Nhân viên (Idempotent Staff Seed)
  // ========================
  let staffTK = await prisma.taiKhoan.findUnique({
    where: { TenDangNhap: "nhanvien01" },
    include: { NhanVien: true }
  });
  if (!staffTK) {
    staffTK = await prisma.taiKhoan.create({
      data: {
        TenDangNhap: "nhanvien01",
        MatKhau: hashedPassword,
        HoTen: "Nhân viên test",
        Email: "nhanvien01@example.com",
        SoDienThoai: "0900000001",
        GioiTinh: true,
        NgaySinh: new Date("2000-01-01"),
        VaiTro: Role.STAFF,
        KhaDung: true,
        NhanVien: {
          create: {
            ChucVu: "Nhân viên bán vé",
            KhaDung: true,
          },
        },
      },
      include: { NhanVien: true }
    });
    console.log(`✅ Đã tạo tài khoản Nhân viên: ${staffTK.TenDangNhap}`);
  } else {
    console.log(`ℹ️ Tài khoản Nhân viên đã tồn tại. Đang cập nhật thông tin và mật khẩu...`);
    staffTK = await prisma.taiKhoan.update({
      where: { MaTaiKhoan: staffTK.MaTaiKhoan },
      data: {
        MatKhau: hashedPassword,
        HoTen: "Nhân viên test",
        Email: "nhanvien01@example.com",
        SoDienThoai: "0900000001",
        GioiTinh: true,
        NgaySinh: new Date("2000-01-01"),
        VaiTro: Role.STAFF,
        KhaDung: true,
      },
      include: { NhanVien: true }
    });
    if (!staffTK.NhanVien) {
      await prisma.nhanVien.create({
        data: {
          MaTaiKhoan: staffTK.MaTaiKhoan,
          ChucVu: "Nhân viên bán vé",
          KhaDung: true,
        }
      });
    } else {
      await prisma.nhanVien.update({
        where: { MaNhanVien: staffTK.NhanVien.MaNhanVien },
        data: {
          ChucVu: "Nhân viên bán vé",
          KhaDung: true,
        }
      });
    }
    console.log(`✅ Đã đảm bảo tài khoản Nhân viên hợp lệ: ${staffTK.TenDangNhap}`);
  }

  // ========================
  // Tạo/Cập nhật tài khoản Khách hàng
  // ========================
  let customerTK = await prisma.taiKhoan.findUnique({
    where: { TenDangNhap: "khachhang01" },
    include: { KhachHang: true }
  });
  if (!customerTK) {
    customerTK = await prisma.taiKhoan.create({
      data: {
        TenDangNhap: "khachhang01",
        MatKhau: hashedPassword,
        HoTen: "Trần Thị Bích",
        Email: "khachhang01@gmail.com",
        SoDienThoai: "0901000003",
        GioiTinh: false,
        NgaySinh: new Date("2000-03-20"),
        VaiTro: Role.CUSTOMER,
        KhaDung: true,
        KhachHang: {
          create: {
            KhaDung: true,
          },
        },
      },
      include: { KhachHang: true }
    });
    console.log(`✅ Đã tạo tài khoản Khách hàng: ${customerTK.TenDangNhap}`);
  } else {
    console.log(`ℹ️ Tài khoản Khách hàng đã tồn tại: ${customerTK.TenDangNhap}`);
  }

  // ========================
  // Tạo/Cập nhật các Ca làm việc mặc định
  // ========================
  const caLamViecTemplates = [
    { TenCa: "Ca sáng", GioBatDau: new Date("1970-01-01T08:00:00Z"), GioKetThuc: new Date("1970-01-01T12:00:00Z"), SoNguoiToiDa: 3 },
    { TenCa: "Ca chiều", GioBatDau: new Date("1970-01-01T12:00:00Z"), GioKetThuc: new Date("1970-01-01T17:00:00Z"), SoNguoiToiDa: 3 },
    { TenCa: "Ca tối", GioBatDau: new Date("1970-01-01T17:00:00Z"), GioKetThuc: new Date("1970-01-01T22:00:00Z"), SoNguoiToiDa: 3 },
  ];

  const dbCaLamViecs = [];
  for (const template of caLamViecTemplates) {
    let ca = await prisma.caLamViec.findFirst({
      where: { TenCa: template.TenCa, KhaDung: true },
    });
    if (!ca) {
      ca = await prisma.caLamViec.create({
        data: template,
      });
      console.log(`✅ Đã tạo Ca làm việc: ${template.TenCa}`);
    } else {
      console.log(`ℹ️ Ca làm việc đã tồn tại: ${template.TenCa}`);
    }
    dbCaLamViecs.push(ca);
  }

  // ========================
  // Đăng ký lịch làm việc (mock) cho nhanvien01 trong tuần hiện tại
  // ========================
  const staffAccount = await prisma.taiKhoan.findUnique({
    where: { TenDangNhap: "nhanvien01" },
    include: { NhanVien: true }
  });

  if (staffAccount?.NhanVien) {
    const maNhanVien = staffAccount.NhanVien.MaNhanVien;
    
    // Generate dates for current week (Mon-Sun)
    const today = bangkokCalendarDate();
    const currentDay = today.getUTCDay(); // 0 is Sunday, 1-6 is Mon-Sat
    const mondayDiff = currentDay === 0 ? -6 : 1 - currentDay;
    const monday = new Date(today);
    monday.setUTCDate(today.getUTCDate() + mondayDiff);

    // Seed mock shifts for Monday (index 0) to Sunday (index 6)
    for (let i = 0; i < 7; i++) {
      const ngayLamViec = new Date(monday);
      ngayLamViec.setUTCDate(monday.getUTCDate() + i);

      // We assign Ca sáng on Mon/Thu/Sun, Ca chiều on Tue/Fri, Ca tối on Wed/Sat
      let targetCaTemplate = dbCaLamViecs[0]; // Ca sáng
      if (i === 1 || i === 4) targetCaTemplate = dbCaLamViecs[1]; // Ca chiều
      if (i === 2 || i === 5) targetCaTemplate = dbCaLamViecs[2]; // Ca tối

      // Check if registration already exists
      const existingReg = await prisma.chiTietCaLamViec.findFirst({
        where: {
          MaNhanVien: maNhanVien,
          NgayLamViec: ngayLamViec,
          MaCa: targetCaTemplate.MaCa,
          KhaDung: true,
        },
      });

      if (!existingReg) {
        await prisma.chiTietCaLamViec.create({
          data: {
            MaNhanVien: maNhanVien,
            NgayLamViec: ngayLamViec,
            MaCa: targetCaTemplate.MaCa,
            KhaDung: true,
          },
        });
        console.log(`✅ Đã mock ca ${targetCaTemplate.TenCa} vào ngày ${ngayLamViec.toISOString().split("T")[0]} cho nhanvien01`);
      }
    }
  }

  // ========================
  // Tạo dữ liệu loại phòng, sơ đồ ghế, phòng chiếu (nếu chưa có)
  // ========================
  const loaiPhongCount = await prisma.loaiPhong.count();
  if (shouldCleanup || loaiPhongCount === 0) {
    console.log("🏗️ Đang tạo dữ liệu danh mục phòng chiếu, ghế, phim và suất chiếu...");
    const lp2D = await prisma.loaiPhong.create({
      data: { TenLoaiPhong: "2D Standard", PhuThu: 0.0 },
    });
    const lp3D = await prisma.loaiPhong.create({
      data: { TenLoaiPhong: "3D Premium", PhuThu: 20000.0 },
    });
    const lpIMAX = await prisma.loaiPhong.create({
      data: { TenLoaiPhong: "IMAX Ultimate", PhuThu: 50000.0 },
    });

    const soDo = await prisma.soDoGhe.create({
      data: { TenSoDo: "Sơ đồ chuẩn 5x5", SoHang: 5, SoCot: 5 },
    });

    const phong1 = await prisma.phongChieu.create({
      data: { TenPhong: "Phòng chiếu 01", MaLoaiPhong: lp2D.MaLoaiPhong, MaSoDo: soDo.MaSoDo },
    });
    const phong2 = await prisma.phongChieu.create({
      data: { TenPhong: "Phòng chiếu 02 (IMAX)", MaLoaiPhong: lpIMAX.MaLoaiPhong, MaSoDo: soDo.MaSoDo },
    });
    console.log("✅ Đã tạo Loại phòng, Sơ đồ ghế và Phòng chiếu");

    const lgThuong = await prisma.loaiGhe.create({
      data: { TenLoaiGhe: "Thường", PhuThu: 0.0 },
    });
    const lgVIP = await prisma.loaiGhe.create({
      data: { TenLoaiGhe: "VIP", PhuThu: 15000.0 },
    });
    const lgSweetbox = await prisma.loaiGhe.create({
      data: { TenLoaiGhe: "Sweetbox", PhuThu: 30000.0 },
    });

    const rows = ["A", "B", "C", "D", "E"];
    const seatsRoom1: any[] = [];
    const seatsRoom2: any[] = [];

    for (const r of rows) {
      let maLoaiGhe = lgThuong.MaLoaiGhe;
      if (r === "C" || r === "D") maLoaiGhe = lgVIP.MaLoaiGhe;
      if (r === "E") maLoaiGhe = lgSweetbox.MaLoaiGhe;

      for (let c = 1; c <= 5; c++) {
        seatsRoom1.push({
          ViTriDay: r,
          ViTriCot: c,
          MaPhong: phong1.MaPhong,
          MaLoaiGhe: maLoaiGhe,
        });
        seatsRoom2.push({
          ViTriDay: r,
          ViTriCot: c,
          MaPhong: phong2.MaPhong,
          MaLoaiGhe: maLoaiGhe,
        });
      }
    }

    await prisma.ghe.createMany({ data: seatsRoom1 });
    await prisma.ghe.createMany({ data: seatsRoom2 });

    const allGhesPhong1 = await prisma.ghe.findMany({ where: { MaPhong: phong1.MaPhong } });
    const allGhesPhong2 = await prisma.ghe.findMany({ where: { MaPhong: phong2.MaPhong } });
    console.log(`✅ Đã tạo xong 50 ghế (25 ghế/phòng)`);

    const lnThuong = await prisma.loaiNgay.create({
      data: { TenLoaiNgay: "Ngày thường", PhuThu: 0.0 },
    });
    const lnCuoiTuan = await prisma.loaiNgay.create({
      data: { TenLoaiNgay: "Cuối tuần", PhuThu: 15000.0 },
    });
    const lnNgayLe = await prisma.loaiNgay.create({
      data: { TenLoaiNgay: "Ngày lễ", PhuThu: 30000.0 },
    });
    console.log("✅ Đã tạo Loại ngày");

    // Demo dates are relative to the day the seed runs, so interview data never expires.
    const demoDate = (offsetInDays: number) => bangkokCalendarDate(offsetInDays);

    const showtime = (hour: number, minute = 0) => new Date(Date.UTC(1970, 0, 1, hour, minute, 0));

    const phimData = [
      {
        TenPhim: "Avengers: Endgame",
        ThoiLuong: 181,
        TheLoai: "Hành động, Khoa học viễn tưởng",
        NgayKhoiChieu: demoDate(-30),
        NgayKetThuc: demoDate(30),
        DaoDien: "Anthony Russo, Joe Russo",
        DienVien: "Robert Downey Jr., Chris Evans, Mark Ruffalo, Chris Hemsworth",
        GioiHanTuoi: GioiHanTuoi.C13,
        NoiDung: "Sau sự kiện thảm khốc của Infinity War, các Avengers còn sống phải đối mặt với nhiệm vụ cuối cùng.",
        Trailer: "https://www.youtube.com/watch?v=TcMBFSGVi1c",
        HinhAnh: "https://example.com/images/avengers-endgame.jpg",
        KhaDung: true,
      },
      {
        TenPhim: "Inception",
        ThoiLuong: 148,
        TheLoai: "Khoa học viễn tưởng, Hành động",
        NgayKhoiChieu: demoDate(-14),
        NgayKetThuc: demoDate(45),
        DaoDien: "Christopher Nolan",
        DienVien: "Leonardo DiCaprio, Joseph Gordon-Levitt, Elliot Page",
        GioiHanTuoi: GioiHanTuoi.C13,
        NoiDung: "Dom Cobb là tên trộm tài năng với khả năng xâm nhập vào giấc mơ của người khác.",
        Trailer: "https://www.youtube.com/watch?v=YoHD9XEInc0",
        HinhAnh: "https://example.com/images/inception.jpg",
        KhaDung: true,
      },
      {
        TenPhim: "The Lion King",
        ThoiLuong: 118,
        TheLoai: "Hoạt hình, Gia đình",
        NgayKhoiChieu: demoDate(14),
        NgayKetThuc: demoDate(75),
        DaoDien: "Jon Favreau",
        DienVien: "Donald Glover, Beyoncé, Seth Rogen, Chiwetel Ejiofor",
        GioiHanTuoi: GioiHanTuoi.P,
        NoiDung: "Simba, một con sư tử con, phải trốn chạy khỏi vương quốc của mình sau cái chết bi thảm của cha.",
        Trailer: "https://www.youtube.com/watch?v=7TavVZMewpY",
        HinhAnh: "https://example.com/images/lion-king.jpg",
        KhaDung: true,
      },
      {
        TenPhim: "Joker",
        ThoiLuong: 122,
        TheLoai: "Tâm lý, Tội phạm",
        NgayKhoiChieu: demoDate(30),
        NgayKetThuc: null,
        DaoDien: "Todd Phillips",
        DienVien: "Joaquin Phoenix, Robert De Niro, Zazie Beetz",
        GioiHanTuoi: GioiHanTuoi.C18,
        NoiDung: "Câu chuyện về Arthur Fleck, một diễn viên hài bị xã hội ruồng bỏ, dần trở thành Joker.",
        Trailer: "https://www.youtube.com/watch?v=zAGVQLHvwOY",
        HinhAnh: "https://example.com/images/joker.jpg",
        KhaDung: true,
      },
      {
        TenPhim: "Spider-Man: No Way Home",
        ThoiLuong: 148,
        TheLoai: "Hành động, Khoa học viễn tưởng",
        NgayKhoiChieu: demoDate(-7),
        NgayKetThuc: demoDate(60),
        DaoDien: "Jon Watts",
        DienVien: "Tom Holland, Zendaya, Benedict Cumberbatch, Jamie Foxx",
        GioiHanTuoi: GioiHanTuoi.C13,
        NoiDung: "Peter Parker tìm đến Doctor Strange để giúp thế giới quên rằng anh là Spider-Man.",
        Trailer: "https://www.youtube.com/watch?v=JfVOs4VSpmA",
        HinhAnh: "https://example.com/images/spiderman-no-way-home.jpg",
        KhaDung: true,
      },
      {
        TenPhim: "Interstellar",
        ThoiLuong: 169,
        TheLoai: "Khoa học viễn tưởng, Phiêu lưu",
        NgayKhoiChieu: demoDate(21),
        NgayKetThuc: null,
        DaoDien: "Christopher Nolan",
        DienVien: "Matthew McConaughey, Anne Hathaway, Jessica Chastain",
        GioiHanTuoi: GioiHanTuoi.C13,
        NoiDung: "Một nhóm nhà du hành vũ trụ du hành qua lỗ sâu trong vũ trụ để tìm kiếm hy vọng cho loài người.",
        Trailer: "https://www.youtube.com/watch?v=zSWdZVtXT7E",
        HinhAnh: "https://example.com/images/interstellar.jpg",
        KhaDung: true,
      },
      {
        TenPhim: "Parasite",
        ThoiLuong: 132,
        TheLoai: "Tâm lý, Giật gân",
        NgayKhoiChieu: demoDate(-40),
        NgayKetThuc: demoDate(10),
        DaoDien: "Bong Joon Ho",
        DienVien: "Song Kang-ho, Lee Sun-kyun, Cho Yeo-jeong",
        GioiHanTuoi: GioiHanTuoi.C18,
        NoiDung: "Một gia đình nghèo tìm cách thâm nhập vào cuộc sống của một gia đình giàu có.",
        Trailer: "https://www.youtube.com/watch?v=SEUXfv875pk",
        HinhAnh: "https://example.com/images/parasite.jpg",
        KhaDung: true,
      },
      {
        TenPhim: "Inside Out 2",
        ThoiLuong: 96,
        TheLoai: "Hoạt hình, Gia đình, Hài hước",
        NgayKhoiChieu: demoDate(-20),
        NgayKetThuc: demoDate(20),
        DaoDien: "Kelsey Mann",
        DienVien: "Amy Poehler, Phyllis Smith, Lewis Black",
        GioiHanTuoi: GioiHanTuoi.P,
        NoiDung: "Tâm trí của cô bé Riley khi bước vào tuổi dậy thì với những cảm xúc mới xuất hiện.",
        Trailer: "https://www.youtube.com/watch?v=LEjhY15eCx0",
        HinhAnh: "https://example.com/images/inside-out-2.jpg",
        KhaDung: true,
      },
      {
        TenPhim: "Dune: Part Two",
        ThoiLuong: 166,
        TheLoai: "Khoa học viễn tưởng, Phiêu lưu",
        NgayKhoiChieu: demoDate(-90),
        NgayKetThuc: demoDate(-10),
        DaoDien: "Denis Villeneuve",
        DienVien: "Timothée Chalamet, Zendaya, Rebecca Ferguson",
        GioiHanTuoi: GioiHanTuoi.C13,
        NoiDung: "Paul Atreides tìm kiếm sự trả thù chống lại những kẻ đã tiêu diệt gia đình mình.",
        Trailer: "https://www.youtube.com/watch?v=Way9Dexny3w",
        HinhAnh: "https://example.com/images/dune-part-2.jpg",
        KhaDung: true,
      },
      {
        TenPhim: "Spirited Away",
        ThoiLuong: 125,
        TheLoai: "Hoạt hình, Kỳ ảo",
        NgayKhoiChieu: demoDate(-10),
        NgayKetThuc: demoDate(35),
        DaoDien: "Hayao Miyazaki",
        DienVien: "Rumi Hiiragi, Miyu Irino, Mari Natsuki",
        GioiHanTuoi: GioiHanTuoi.P,
        NoiDung: "Cô bé Chihiro lạc vào vùng đất linh hồn bí ẩn để cứu cha mẹ mình.",
        Trailer: "https://www.youtube.com/watch?v=ByXuk9QqQkk",
        HinhAnh: "https://example.com/images/spirited-away.jpg",
        KhaDung: true,
      },
    ];

    const createdMovies: any[] = [];
    for (const phim of phimData) {
      const p = await prisma.phim.create({ data: phim });
      createdMovies.push(p);
      console.log(`🎬 Đã tạo phim: ${phim.TenPhim}`);
    }

    const showtimesToSeed = [
      {
        movieIndex: 0, // Avengers: Endgame
        phong: phong2,
        loaiNgay: lnCuoiTuan,
        ngayChieu: demoDate(0),
        gioChieu: showtime(19, 0),
        giaVeGoc: 90000.0,
      },
      {
        movieIndex: 7, // Inside Out 2
        phong: phong1,
        loaiNgay: lnThuong,
        ngayChieu: demoDate(0),
        gioChieu: showtime(16, 0),
        giaVeGoc: 70000.0,
      },
      {
        movieIndex: 1, // Inception
        phong: phong1,
        loaiNgay: lnThuong,
        ngayChieu: demoDate(0),
        gioChieu: showtime(20, 30),
        giaVeGoc: 70000.0,
      },
      {
        movieIndex: 4, // Spider-Man: No Way Home
        phong: phong2,
        loaiNgay: lnCuoiTuan,
        ngayChieu: demoDate(1),
        gioChieu: showtime(10, 0),
        giaVeGoc: 85000.0,
      },
      {
        movieIndex: 9, // Spirited Away
        phong: phong1,
        loaiNgay: lnThuong,
        ngayChieu: demoDate(1),
        gioChieu: showtime(14, 30),
        giaVeGoc: 75000.0,
      },
      {
        movieIndex: 0, // Avengers: Endgame
        phong: phong2,
        loaiNgay: lnCuoiTuan,
        ngayChieu: demoDate(2),
        gioChieu: showtime(18, 30),
        giaVeGoc: 95000.0,
      },
      {
        movieIndex: 6, // Parasite
        phong: phong1,
        loaiNgay: lnThuong,
        ngayChieu: demoDate(2),
        gioChieu: showtime(21, 0),
        giaVeGoc: 70000.0,
      },
      { movieIndex: 1, phong: phong2, loaiNgay: lnThuong, ngayChieu: demoDate(3), gioChieu: showtime(19, 30), giaVeGoc: 85000.0 },
      { movieIndex: 7, phong: phong1, loaiNgay: lnThuong, ngayChieu: demoDate(4), gioChieu: showtime(17, 0), giaVeGoc: 70000.0 },
      { movieIndex: 4, phong: phong2, loaiNgay: lnCuoiTuan, ngayChieu: demoDate(5), gioChieu: showtime(20, 0), giaVeGoc: 95000.0 },
      { movieIndex: 9, phong: phong1, loaiNgay: lnCuoiTuan, ngayChieu: demoDate(6), gioChieu: showtime(15, 30), giaVeGoc: 80000.0 },
      { movieIndex: 0, phong: phong2, loaiNgay: lnCuoiTuan, ngayChieu: demoDate(7), gioChieu: showtime(18, 0), giaVeGoc: 95000.0 },
    ];

    const createdShowtimes = [];
    for (const item of showtimesToSeed) {
      const sc = await prisma.suatChieu.create({
        data: {
          MaPhim: createdMovies[item.movieIndex].MaPhim,
          MaPhong: item.phong.MaPhong,
          MaLoaiNgay: item.loaiNgay.MaLoaiNgay,
          NgayChieu: item.ngayChieu,
          GioChieu: item.gioChieu,
          GiaVeGoc: item.giaVeGoc,
        },
      });
      createdShowtimes.push(sc);

      // Create GheSuatChieu for all seats in this room
      const allGhes = item.phong.MaPhong === phong1.MaPhong ? allGhesPhong1 : allGhesPhong2;
      const lpPhuThu = Number(item.phong.MaPhong === phong1.MaPhong ? lp2D.PhuThu : lpIMAX.PhuThu);
      
      const gscData = allGhes.map((g) => {
        let phuThuGhe = 0.0;
        if (g.MaLoaiGhe === lgVIP.MaLoaiGhe) phuThuGhe = 15000.0;
        if (g.MaLoaiGhe === lgSweetbox.MaLoaiGhe) phuThuGhe = 30000.0;

        return {
          MaSuatChieu: sc.MaSuatChieu,
          MaGhe: g.MaGhe,
          TrangThai: TrangThaiGheSuatChieu.TRONG,
          GiaVe: Number(item.giaVeGoc) + lpPhuThu + phuThuGhe,
        };
      });

      await prisma.gheSuatChieu.createMany({ data: gscData });
      console.log(`✅ Đã tạo Suất chiếu cho phim ${createdMovies[item.movieIndex].TenPhim} & 25 Ghế suất chiếu`);
    }

    const randomGsc = await prisma.gheSuatChieu.findFirst({
      where: { MaSuatChieu: createdShowtimes[1].MaSuatChieu },
    });

    if (randomGsc && customerTK?.KhachHang) {
      await prisma.gheSuatChieu.update({
        where: { MaGheSuatChieu: randomGsc.MaGheSuatChieu },
        data: { TrangThai: TrangThaiGheSuatChieu.DA_DAT },
      });

      const phieu = await prisma.phieuDatVe.create({
        data: {
          MaKhachHang: customerTK.KhachHang.MaKhachHang,
          TongTien: randomGsc.GiaVe,
          TrangThai: "DA_THANH_TOAN",
          ChiTietDatVes: {
            create: {
              MaGheSuatChieu: randomGsc.MaGheSuatChieu,
              GiaVe: randomGsc.GiaVe,
            },
          },
        },
      });
      console.log(`🎟️ Đã giả lập bán 1 vé thành công cho phim Inside Out 2 (MaPhieuDat: ${phieu.MaPhieuDat})`);
    }
  } else {
    console.log("ℹ️ Đã có dữ liệu danh mục phòng chiếu, ghế, phim và suất chiếu. Bỏ qua tạo mới.");
  }

  console.log("\n✨ Seed dữ liệu hoàn tất!");
  console.log("📋 Tài khoản mặc định:");
  console.log("   Admin     - TenDangNhap: admin        | MatKhau: 123456");
  console.log("   Nhân viên - TenDangNhap: nhanvien01  | MatKhau: 123456");
  console.log("   Khách hàng- TenDangNhap: khachhang01 | MatKhau: 123456");
}

main()
  .catch((e) => {
    console.error("❌ Lỗi seed dữ liệu:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
