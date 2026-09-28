# Admin: đọc flow và chuẩn bị phỏng vấn

## Phạm vi

Dự án hai người; tài liệu này tập trung nhánh Admin, không nhận toàn bộ customer
hoặc payment gateway là đóng góp cá nhân. Đối chiếu commit và phân công
thực tế trước khi dùng câu “em xây dựng”. Các thay đổi trong đợt này: test an toàn,
chống hoàn tiền trùng, bảo toàn ghế đã được người khác giữ/đặt, tài liệu flow.

## Thứ tự đọc trong 60–90 phút

1. `src/routes/index.ts`: middleware xác thực và `requireRoles(Role.ADMIN)`
   chạy trước mọi router con. Ẩn menu frontend không phải bảo mật.
2. Chọn router nghiệp vụ → validator → controller → service → repository.
   Controller lấy input/trả response; service kiểm tra nghiệp vụ; repository truy
   cập Prisma. Một số service hiện vẫn gọi Prisma trực tiếp; không mô tả dự án
   như một kiến trúc phân lớp tuyệt đối.
3. `prisma/schema.prisma`: lần theo Phim, SuatChieu, GheSuatChieu,
   ChiTietDatVe, PhieuDatVe, GiaoDich, LichSuHoanTien.
4. `tests/integration/adminRefund.test.ts`: đọc tên test, fixture và assertion
   trước khi đọc kỹ phần implementation hoàn tiền.

| Luồng | Điểm vào dưới `/api/v1/admin` | File nên đọc |
| --- | --- | --- |
| Phim | `/phim` | `phim.routes.ts`, `phim.service.ts`, `phim.repository.ts` |
| Phòng, sơ đồ, ghế | `/phong-chieu`, `/so-do-ghe` | `phongchieu.service.ts`, `sodoghe.service.ts` |
| Xếp lịch | `/suat-chieu` | `suatchieu.service.ts` và test cùng tên |
| Tài khoản | `/nguoi-dung` | `modules/identity/user-admin/user.service.ts` |
| Giao dịch | `/giao-dich` | `giaodich.service.ts` |
| Yêu cầu hoàn | `/hoan-tien` | `hoantien.service.ts`, `hoantien.repository.ts` |
| Dashboard | `/thong-ke/doanh-thu`, `/thong-ke/ti-le-ghe` | `thongke.service.ts` |

## Luồng trọng tâm: ghi nhận hoàn tiền thủ công

Quan trọng: API không chuyển tiền qua ngân hàng/PayOS. Admin thực hiện chuyển
tiền ngoài hệ thống và chỉ xác nhận sau khi đã đối soát. Không trình bày đây là
một hệ thống refund tự động hoặc bảo đảm exactly-once ở ngân hàng.

Customer gửi yêu cầu → booking chuyển `DA_HUY`, lịch sử ở `CHO_XU_LY`.
Đây là hành vi hiện tại của luồng customer, không phải thay đổi trong đợt này.
Admin mở chi tiết → kiểm tra giao dịch/thông tin ngân hàng → chuyển tiền thủ
công → `PATCH /hoan-tien/:maHoanTien/duyet`.

Trong một Prisma transaction:

1. Đọc lại yêu cầu, chỉ cho xử lý yêu cầu còn khả dụng và `CHO_XU_LY`.
2. Kiểm tra số tiền dương và không vượt giá trị giao dịch.
3. Conditional update trên GiaoDich: `THANH_CONG` → `DA_HOAN_TIEN`.
   `count !== 1` thì hủy thao tác. Hai endpoint hoàn tiền dùng cùng điểm chặn.
4. Conditional update lịch sử: `CHO_XU_LY` → `DA_HOAN`, ghi ngày hoàn.
5. Đặt booking `DA_HUY`; chỉ nhả ghế `DA_DAT` thuộc booking cũ và không có
   chi tiết vé khả dụng của booking khác đang chờ thanh toán/đã thanh toán.
6. Commit tất cả hoặc rollback tất cả nếu bất kỳ bước nào thất bại.

`src/modules/billing/refund/refundSettlement.ts` chứa hai thao tác dùng chung. Chặn ở DB
mới xử lý được nhiều request đồng thời; disable nút UI chỉ cải thiện trải nghiệm.
Request lặp bị từ chối, không phải replay lại response thành công cũ.

Luồng hoàn trực tiếp trong `giaodich.service.ts` cũng claim cùng giao dịch; nếu
có yêu cầu chờ duyệt thì từ chối và yêu cầu đi qua luồng yêu cầu hoàn. Từ chối
yêu cầu dùng conditional update `CHO_XU_LY` → `TU_CHOI`, không chuyển tiền.

## Verify không dùng browser

Cần dependencies, Prisma client và MySQL local đang chạy. `.env` chứa kết nối
local hợp lệ; không commit hoặc đưa giá trị bí mật vào tài liệu/PR.

```sh
node node_modules/typescript/bin/tsc --noEmit
npm run build
npm test -- --runInBand
```

Runner chỉ nhận localhost/127.0.0.1, tạo schema `nex_cinema_admin_test`, chạy
`prisma db push` rồi Jest tuần tự. **Schema này dành riêng cho test, dữ liệu bên
trong bị test xóa.** Không đặt dữ liệu demo/ứng dụng vào schema này. Tài khoản
MySQL cần quyền tạo schema. `tests/setup.ts` từ chối DB không có hậu tố `_test`
hoặc `_test_db`; đây là guard chống nhầm DB, không thay thế việc kiểm tra URL.

Baseline của đợt: 17 suite / 166 test pass và TypeScript build pass. Có test 8
request duyệt đồng thời chỉ một thành công; duyệt vs từ chối; hai lối hoàn tiền;
rollback khi thao tác ghế lỗi; không nhả ghế đã giữ/bán cho booking khác.
Không suy ra toàn bộ payment provider bên ngoài đã được E2E kiểm thử.

## Hạn chế cần nói thật

- Lý do từ chối do frontend gửi hiện chưa được backend lưu. Không dùng tính
  năng này như bằng chứng audit đầy đủ.
- Customer tạo yêu cầu có precheck ngoài transaction; đợt này không chứng minh
  chống race toàn bộ vòng đời customer booking/cancel/refund request.
- Từ chối yêu cầu không tự phục hồi booking đã hủy.
- Hoàn một phần chưa phải một workflow hoàn chỉnh: ghi nhận hoàn sẽ đóng
  giao dịch/booking. Demo hoàn toàn phần; không quảng bá partial-refund đầy đủ.
- Thống kê doanh thu là giao dịch thành công thuộc booking đã thanh toán còn
  khả dụng, không phải sổ cái kế toán; booking hủy có thể bị loại trước khi tiền
  thực chuyển. Bộ lọc doanh thu dùng ngày UTC.
- Prisma/MySQL giữ các thay đổi DB nguyên tử; không bao trùm việc chuyển tiền
  ngoài hệ thống. Nâng cấp sau: audit người duyệt, mã đối soát, idempotency key
  của provider và cơ chế reconciliation.

## Tập trả lời

- “Vì sao tách helper?” Hai đường hoàn tiền phải dùng cùng điều kiện thắng,
  tránh sửa một đường nhưng bỏ sót đường còn lại.
- “Vì sao check trước rồi update chưa đủ?” Hai request có thể cùng đọc trạng
  thái cũ; conditional update và kiểm tra count quyết định ở thời điểm ghi.
- “Ghế cũ có thể đã bán lại thì sao?” Liên kết vé cũ vẫn còn trong lịch sử;
  phải kiểm tra quyền sử dụng hiện tại, không chỉ tìm theo booking cũ.
- “Em chứng minh rollback thế nào?” Test gây lỗi lúc cập nhật ghế, rồi đọc lại
  giao dịch, lịch sử, booking và ghế để xác nhận không có cập nhật dở dang.
