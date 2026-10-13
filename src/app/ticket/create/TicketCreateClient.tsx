"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useMutation, useQuery } from "@tanstack/react-query"
import { CaptchaWidget } from "@/components/captcha-widget"
import { TicketShell } from "@/components/ticket-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SelectCustom } from "@/components/ui/select-custom"
import { toast } from "@/components/ui/toast"
import { IconTicket, IconEnvelope, IconQuestionCircle, IconCheck } from "@/components/icons"
import { useTRPC } from "@/trpc/client"

const SUBJECT_OPTIONS = [
  { value: "deposit", label: "Nạp tiền" },
  { value: "account", label: "Tài khoản" },
  { value: "order", label: "Đơn hàng" },
  { value: "other", label: "Khác" },
]

export function TicketCreateClient() {
  const trpc = useTRPC()
  const router = useRouter()
  const [title, setTitle] = useState("")
  const [subject, setSubject] = useState("deposit")
  const [content, setContent] = useState("")
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const guideQuery = useQuery(trpc.ticket.createGuideConfig.queryOptions(undefined, { staleTime: 60_000 }))

  const createMutation = useMutation(trpc.ticket.create.mutationOptions({
    onSuccess: (result) => {
      toast.success(result.message)
      router.push(`/ticket/${result.id}`)
    },
    onError: (error) => toast.error(error.message),
  }))
  function submit() {
    if (!title.trim() || !content.trim()) {
      toast.error("Vui lòng nhập đủ tiêu đề và nội dung")
      return
    }
    createMutation.mutate({ title, subject: subject as "deposit" | "account" | "order" | "other", content, captchaToken: captchaToken ?? undefined })
  }

  return (
    <TicketShell>
      <div className="space-y-6">
        <header className="space-y-1">
          <nav className="flex items-center gap-1.5 text-sm text-muted-foreground"><a href="/dashboard" className="hover:text-foreground">Trang chủ</a><span>/</span><span className="text-foreground">Tạo vé hỗ trợ</span></nav>
          <div className="flex items-center gap-3"><div className="flex size-11 items-center justify-center rounded-xl bg-rose-500/15 text-rose-600"><IconTicket size={22} /></div><div><h1 className="text-2xl font-bold tracking-tight">Tạo vé hỗ trợ</h1><p className="text-sm text-muted-foreground">Gửi yêu cầu rõ ràng để đội ngũ hỗ trợ phản hồi nhanh hơn.</p></div></div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="mb-5 flex items-center gap-3 border-b pb-4"><div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><IconEnvelope size={20} /></div><div><h2 className="font-semibold">Thông tin yêu cầu</h2><p className="text-sm text-muted-foreground">Mô tả vấn đề, mã giao dịch hoặc mã đơn nếu có.</p></div></div>
            <div className="space-y-4">
              <Field label="Tiêu đề"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="VD: Lỗi nạp tiền qua ngân hàng" /></Field>
              <Field label="Chủ đề"><SelectCustom value={subject} onValueChange={setSubject} options={SUBJECT_OPTIONS} /></Field>
              <Field label="Nội dung"><textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Mô tả chi tiết vấn đề của bạn..." rows={8} className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50" /></Field>
              <CaptchaWidget action="create_ticket" onVerify={setCaptchaToken} />
              <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => router.push("/customer/history/ticket")}>Hủy</Button><Button onClick={submit} disabled={createMutation.isPending}>{createMutation.isPending ? "Đang gửi..." : "Gửi yêu cầu"}</Button></div>
            </div>
          </div>
          <aside className="space-y-4">
            <div className="rounded-2xl border bg-card p-5"><div className="flex items-center gap-2 font-semibold"><IconQuestionCircle size={18} /> Lưu ý</div><div className="mt-4 space-y-3 text-sm text-muted-foreground" dangerouslySetInnerHTML={{ __html: guideQuery.data?.noteHtml ?? "<p>• Cung cấp mã giao dịch hoặc mã đơn hàng nếu liên quan.</p><p>• Tài khoản chỉ được mở tối đa 3 ticket chưa đóng.</p><p>• Không gửi mật khẩu hoặc thông tin nhạy cảm trong ticket.</p>" }} /></div>
            <div className="rounded-2xl border bg-card p-5"><div className="flex items-center gap-2 font-semibold"><IconCheck size={18} /> Quy trình xử lý</div><div className="mt-4 space-y-3 text-sm text-muted-foreground" dangerouslySetInnerHTML={{ __html: guideQuery.data?.processHtml ?? "<ol><li>Bạn gửi yêu cầu hỗ trợ.</li><li>Admin phản hồi trong khung chat 1-1.</li><li>Bạn có thể đóng ticket khi đã xử lý xong.</li></ol>" }} /></div>
          </aside>
        </section>
      </div>
    </TicketShell>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>
}
