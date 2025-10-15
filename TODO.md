# Ke hoach nang cap KPI v4.0

## 1. Import Data
- [x] Tu dong ghi nhan doanh nghiep/MST moi vao tab `Gan MST` (danh dau trang thai "chua gan nhan vien").
- [x] Mo quyen chinh sua cho tai khoan Nhan vien tren tat ca to khai thuoc team minh; chan thao tac tren team khac.
- [x] Ho tro nhan tieu de cot `Ngay DK` (ngoai `date`) khi import Excel.
- [x] Thay truong nhap text bang selector co goi y:
  - [x] Chon nhan vien -> tu dong dien to doi.
  - [x] Chon to doi -> chi hien nhan vien thuoc to do.
- [x] Them nut `Cap nhat` cho tung dong da sua; chi ghi xuong storage cac truong changed.
- [x] Ghi nhat ky chinh sua (truoc/sau, nguoi sua, thoi gian) va cho phep thu gon/mo rong theo dong.
- [x] Cho phep admin cau hinh danh sach cot (hien/an), ap dung toan he thong.
- [x] An tuy chon "Ghi de toan bo du lieu" voi tai khoan khong phai admin; them popup canh bao khi admin kich hoat.
- [x] Ghi log import chi tiet (file, dong loi, doanh nghiep moi, so dong insert/update/skip).
- [x] Them buoc preview/validate truoc khi commit vao CSDL (hien cac dong loi, dong se chen moi).
- [x] Ho tro quick search, luu bo loc ua thich (theo MST, ten cong ty, trang thai).
- [x] Freeze cot quan trong (so to khai, MST, ngay) va tuy chon view bang/card.
- [x] Thiet ke lai UI Import Data theo phong cach don gian, dong nhat voi cac tab khac.

## 2. Gan MST
- [x] Kich hoat loc theo khoang thoi gian va thao tac; tu dong apply khi thay doi filter.
- [x] Khi import/dong bo, day doanh nghiep/MST moi len dau danh sach de admin/QL gan nhanh.
- [x] Input nhan vien co typeahead + dropdown keo cuon; ho tro phim tat chon nhanh.
- [x] Them nut `Cap nhat` tren moi dong sua doi; chi ghi xuong storage cac truong thay doi.
- [x] Bo sung quick search, luu bo loc (theo nhan vien, thao tac).
- [x] Tai cau truc giao dien tab Gan MST theo huong hien dai; tai su dung component chung.

## 3. Dai ly Hai quan
- [x] Bo sung filter theo dai ly va trang thai cap nhat.
- [x] Luu lich su thay doi dai ly (truoc/sau, nguoi sua, thoi gian) va hien thi khi mo.
- [x] Auto-complete danh sach dai ly (go ky tu -> goi y, hoac chon tu dropdown).
- [x] Them nut cap nhat tung dong; chi ghi cac dong thuc su thay doi.

## 4. Quy tac KPI
- [x] Auto-complete ma dai ly HQ trong toan bo form.
- [x] Auto-complete & multi-select ma giay phep (phan diem giay phep, loai tru theo dai ly).
- [x] Mac dinh thu gon muc "Lich su cap nhat diem KPI".
- [x] De xuat giao dien moi (gan gon, giu du chan dung thong tin), trinh bay, sau do trien khai.
- [x] Cho phep tinh toan KPI "thu" theo rule moi (simulate) truoc khi ap dung that.
- [x] Luu version rule, ho tro rollback nhanh neu can.

## 5. Diem KPI +/- Them
- [x] Bo sung cac hang muc moi (co diem mac dinh va cho phep chinh):
  - [x] Loai bo "Di lam muon".
  - [x] "Ho tro xin giay phep": chon ma giay phep; ZB02=2 diem, ZB03/khac=1.5 (chinh duoc).
  - [x] "Ho tro khac": che do diem co dinh (mac dinh 10) hoac linh hoat (0.1 * so luong).
  - [x] "Sua to khai bo sung C/O": so luong * 1.5 (chinh duoc).
  - [x] Chinh "Ho tro thong quan" -> luong xanh (0.1), luong vang + do (0.25).
- [x] Admin/QL duoc cai dat, luu diem mac dinh hang muc.
- [x] Hien cac hang muc moi trong Bao cao KPI va file export.
- [x] Popup xem chi tiet truoc khi duyet (ghi chu, tham chieu to khai/quyet dinh).
- [x] Popup huong dan nhap lieu (mo/dong) cho tab nay.
- [x] Tai cau truc UI tab nham dong bo phong cach thiet ke moi.

## 6. Bao cao KPI
- [x] Phan "Diem KPI +/- bo sung": them tuy chon so muc moi trang (5/10/20).
- [x] Thiet ke lai UI Bao cao tong hop & chi tiet (gom nut, don gian hoa, phan nhom).
- [x] Xet them tinh nang lap lich gui Bao cao (Excel/PDF) qua email theo tuan/thang.
- [x] Ho tro export, preview KPI theo rule moi (tu muc simulate o muc 4).

## 7. Suc khoe du lieu
- [x] An tab doi voi Nhan vien/Truong nhom; chi show Admin & Quan ly.
- [x] Hien thi trang thai backup gan nhat (thoi gian, duong dan).
- [x] Canh bao khi qua han backup hoac khi dung luong DB vuot nguong.
- [x] Lich backup dinh ky; log ket qua (thanh cong/that bai) trong nhat ky.
- [x] Kiem tra dinh ky ket noi SQL Server, dung luong database, dung luong o dia.

## 8. Tai khoan
- [x] Khi tao tai khoan moi: chon nhan vien tu du lieu KPI (auto-complete).
- [x] Sua lai nut "Xoa" de thuc su xoa tai khoan (co xac nhan).
- [x] Gioi han quyen "Doi chieu KPI tu dong" cho Quan ly/Admin.
- [x] Ghi log chi tiet moi lan thay doi quyen, reset mat khau.

## 9. Nhat ky
- [x] Bo sung thao tac sao luu va phuc hoi co so du lieu truc tiep trong giao dien; ghi log chi tiet.
- [x] Cho phep loc su kien theo loai (import, gan MST, KPI rules, backup...).
- [x] Ghi chu chi tiet cho thao tac quan trong (nguoi thuc hien, noi dung, ket qua).
- [x] Cung cap nut tai log theo khoang thoi gian.

## 10. Tu dong hoa & kiem thu
- [ ] Xay dung test tu dong cho cac quy trinh chinh (import, gán MST, doi chieu giay phep, KPI rules, points, phan quyen).
- [ ] Thiet lap lint/test chay truoc commit/CI.
- [ ] Bo sung script kiem tra ket noi SQL, dung luong storage, tinh trang backup (co the ket hop `pnpm healthcheck`). 
- [ ] Cap nhat README/huong dan sau moi nhom tinh nang hoan thanh.
- [ ] Schedule job (hoac script) kiem tra/ canh bao khi dong bo ECUS gap loi (email/slack).

## 11. UI/UX chung
- [ ] Xay dung thu vien component chung cho bang, selector, popup, badge.
- [ ] Dong bo phong cach (font, mau, border, spacing) giua cac tab.
- [ ] Ho tro quick search va luu filter (Import Data, Gan MST, Bao cao).
- [ ] Hien badge trang thai to khai (moi import, cho gan, da ra soat, can xem lai).
- [ ] Xem xet layout linh hoat (bang/luoi) voi che do freeze cot.
- [ ] Toi uu tra cuu: go ky tu la loc (client-side) nhung ho tro server-side khi du lieu lon.

