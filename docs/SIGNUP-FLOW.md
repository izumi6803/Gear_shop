# Thiết kế luồng đăng ký (Sign up flow)

Tài liệu này ghi lại thiết kế đã chốt cho luồng đăng ký người dùng mới — theo quy trình
brief → wireframe → chọn phương án → dựng.

## 1. Brief (đã duyệt)

| # | Điều | Nguồn |
|---|---|---|
| 1 | Sản phẩm: sàn thiết bị văn phòng, có back office cho Admin/Sales/Viewer | đọc code |
| 2 | Người dùng: khách mua lẻ, trả bằng thẻ hoặc khi nhận hàng | đọc code |
| 3 | Việc chính: ① tạo tài khoản ② đặt đơn đầu tiên ③ xem lại đơn | đọc code |
| 4 | Nền tảng: web, chủ yếu desktop; vẫn phải chạy tốt ở 390px | đọc code |
| 5 | Khác biệt: ship miễn phí từ 500 US$, 2 hình thức thanh toán | đọc code |

## 2. Phương án đã chọn: **ghép B + C**

- **C** cho bố cục: chia đôi màn, nửa trái nói vì sao nên có tài khoản (ship miễn phí, 2 cách
  thanh toán, hoá đơn PDF), nửa phải là form.
- **B** cho cách chia bước: wizard 2 bước có thanh tiến trình.
  - Bước 1 (Tài khoản): email + mật khẩu + nhắc lại — 3 ô.
  - Bước 2 (Nhận hàng): họ tên + điện thoại + địa chỉ, **bỏ qua được**.

Lý do: việc chính là tạo tài khoản để mua, nên bước đầu phải ngắn nhất; các ô chưa cần cho
đơn hàng đầu tiên (tên, điện thoại, địa chỉ) dời sang bước 2 và cho phép bỏ qua — đúng luật
"thời gian tới giá trị" (mỗi bước thêm là một chỗ người mới bỏ đi).

Hai phương án còn lại đã cân nhắc và bỏ:
- **A. Một trang một cột**: 1 lần bấm nhưng form 6 ô nhìn dài, không có chỗ nói lợi ích.
- **C đơn thuần** (chia đôi, một trang): giữ được phần bán lợi ích nhưng vẫn phải điền 6 ô mới xong.

## 3. Luồng thật (route + testid)

```
/shop (khách chưa đăng nhập)
  └─ "Đăng ký" → /register
        ├─ BƯỚC 1 — ô: register-email, register-password, register-confirm
        │     ├─ lỗi từng ô (dưới ô, viền đỏ): register-error-email / -password / -confirm
        │     ├─ "Tiếp" (submit form, CHƯA gọi API): register-next
        │     └─ hợp lệ → BƯỚC 2
        ├─ BƯỚC 2 — ô: register-display-name, register-phone, register-address
        │     ├─ "Hoàn tất": register-submit → POST /api/auth/register → tự đăng nhập
        │     ├─ "Bỏ qua": register-skip → đăng ký với dữ liệu tối thiểu
        │     └─ lỗi máy chủ/trùng email: register-error (quay về bước 1)
        ├─ "Đã có tài khoản?" → /login
        └─ quên mật khẩu → /forgot-password → /reset-password
```

Thành công → `navigate('/shop')`, role `Customer`, đã đăng nhập sẵn.

## 4. Quyết định thiết kế đáng chú ý

| Quyết định | Vì sao | Hệ quả |
|---|---|---|
| **Email là tên đăng nhập** (username = email) | Người dùng toàn cầu nhớ email, không phải nghĩ ra username; giảm bước 1 từ 4 ô xuống 3 | Đăng nhập lại phải bằng email; tài khoản seed (admin/sales/viewer/customer) vẫn dùng username ngắn như cũ |
| Trùng email → câu nói về **email** | Backend trả `AUTH_USERNAME_TAKEN` ("Tên đăng nhập đã được sử dụng") — với người dùng đang nhìn ô "Email" thì câu đó vô nghĩa | Client map 409 → "Email này đã có tài khoản…" |
| Bước 2 không có ô bắt buộc | Người vội vẫn xong sau 3 ô | `displayName` rỗng → server lấy username; client gửi phần trước `@` cho câu chào dễ đọc |
| Validate từng ô thay vì một dòng lỗi chung | Biết ngay ô nào sai, không phải đọc câu tóm tắt | Mỗi ô có `register-error-<field>` để test |
| Panel trái ẩn dưới 900px | Màn hẹp không đủ chỗ cho 2 cột | Mobile chỉ còn form, không tràn ngang (đã kiểm ở 390px) |

## 5. Chưa làm (cần bạn quyết)

- **Nút "Quay lại" ở bước 2**: wireframe đã duyệt không có, nên chưa thêm. Muốn có thì nói.
- **Xác thực email/OTP**: chưa có dịch vụ gửi mail nên chưa làm; hiện đăng ký xong dùng được ngay.
- **Đăng ký bằng Google/mạng xã hội**: chưa có.

## 6. Kiểm chứng

`scripts/qa/16-signup-flow.ps1` — 22 check: bước 1 hiện đúng, validate từng ô khi bỏ trống,
email sai định dạng, nhắc lại mật khẩu lệch, sang bước 2 không gọi API, số điện thoại sai bị
chặn, bỏ qua tạo được tài khoản, đăng nhập lại bằng email, email trùng báo rõ và quay về bước 1,
mobile 390 không tràn ngang, không lỗi JS.
