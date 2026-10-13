/**
 * Catalog tĩnh các cron job của hệ thống — dùng cho tab giám sát Cronjob
 * trong admin settings. `key` phải khớp với key truyền vào trackCronRun()
 * ở mỗi route handler tương ứng.
 *
 * `pathTemplate` dùng token {secret} (và {type} cho job perBank) — service
 * sẽ thay bằng giá trị thật khi build URL hiển thị cho admin.
 */
export interface CronJobMeta {
  /** Key định danh (khớp với bản ghi CronRun trong DB) */
  key: string
  /** Tên hiển thị */
  label: string
  /** Mô tả tác vụ */
  description: string
  /** Path template với token {secret} / {type} */
  pathTemplate: string
  /** Lịch chạy khuyến nghị (hiển thị cho admin) */
  recommended: string
  /** Nếu true → clone 1 hàng cho mỗi ngân hàng active (điền {type}) */
  perBank?: boolean
}

export const CRON_JOBS: CronJobMeta[] = [
  {
    key: "deposit",
    label: "Đối soát nạp tiền",
    description: "Quét giao dịch ngân hàng và khớp với hóa đơn đang chờ thanh toán.",
    pathTemplate: "/cmstdev/cron/deposit/check?type={type}&secret={secret}",
    recommended: "Mỗi 30–60 giây",
    perBank: true,
  },
  {
    key: "campaigns",
    label: "Xử lý chiến dịch gửi",
    description: "Lấy các chiến dịch email/telegram đến hạn và gửi theo lô.",
    pathTemplate: "/cmstdev/cron/campaigns/process?secret={secret}",
    recommended: "Mỗi 30 giây",
  },
  {
    key: "domain",
    label: "Đồng bộ tên miền",
    description: "Poll trạng thái các thao tác Spaceship đang chờ cho đơn tên miền.",
    pathTemplate: "/cmstdev/cron/domain/check?secret={secret}",
    recommended: "Mỗi 30–60 giây",
  },
  {
    key: "website_expire",
    label: "Dừng website hết hạn",
    description: "Kiểm tra và dừng các website chế độ auto đã hết hạn sử dụng.",
    pathTemplate: "/cmstdev/cron/website/check?secret={secret}",
    recommended: "Mỗi 5–10 phút",
  },
  {
    key: "website_domain",
    label: "Đồng bộ domain website",
    description: "Poll thao tác mua domain Spaceship cho đơn website auto-deploy.",
    pathTemplate: "/cmstdev/cron/website/check-domain?secret={secret}",
    recommended: "Mỗi 60 giây",
  },
  {
    key: "website_create",
    label: "Tạo website (hàng đợi)",
    description:
      "Xử lý hàng đợi tạo website tự động: aaPanel + Cloudflare từng bước, retry 3 lần, hoàn tiền khi thất bại.",
    pathTemplate: "/cmstdev/cron/website/create-jobs?secret={secret}",
    recommended: "Mỗi 60 giây",
  },
]
