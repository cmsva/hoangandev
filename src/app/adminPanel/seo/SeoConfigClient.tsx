"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTRPC } from "@/trpc/client"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/components/ui/toast"
import { IconSearch } from "@/components/icons"

interface SeoEntry {
  key: string
  label: string
  path: string
  group: string
  noIndex: boolean
  defaultTitle: string
  defaultDescription: string
  title: string
  description: string
  keywords: string[]
  ogImage: string
}

export function SeoConfigClient() {
  const trpc = useTRPC()
  const { data, isLoading } = useQuery(trpc.adminSeo.list.queryOptions()) as {
    data: SeoEntry[] | undefined
    isLoading: boolean
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
      </div>
    )
  }

  // Group theo entry.group, giữ thứ tự xuất hiện
  const groups: { name: string; items: SeoEntry[] }[] = []
  for (const entry of data) {
    let g = groups.find((x) => x.name === entry.group)
    if (!g) { g = { name: entry.group, items: [] }; groups.push(g) }
    g.items.push(entry)
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground"><a href="/adminPanel/dashboard" className="hover:text-foreground">Admin</a><span>/</span><span>Hệ thống</span><span>/</span><span className="text-foreground">Cấu hình SEO</span></nav>
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-violet-500/15 text-violet-600"><IconSearch size={20} /></div>
          <div><h1 className="text-2xl font-bold tracking-tight">Cấu hình SEO</h1><p className="text-sm text-muted-foreground">Tùy chỉnh tiêu đề, mô tả, từ khóa cho từng trang. Để trống sẽ dùng giá trị mặc định.</p></div>
        </div>
      </div>

      {groups.map((g) => (
        <section key={g.name} className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">{g.name}</h2>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {g.items.map((entry) => <SeoCard key={entry.key} entry={entry} />)}
          </div>
        </section>
      ))}
    </div>
  )
}

function SeoCard({ entry }: { entry: SeoEntry }) {
  const trpc = useTRPC()
  const qc = useQueryClient()
  const [title, setTitle] = useState(entry.title)
  const [description, setDescription] = useState(entry.description)
  const [keywords, setKeywords] = useState<string[]>(entry.keywords)
  const [ogImage, setOgImage] = useState(entry.ogImage)
  const [keywordInput, setKeywordInput] = useState("")

  const mut = useMutation({
    ...trpc.adminSeo.save.mutationOptions(),
    onSuccess: () => {
      toast.success(`Đã lưu SEO: ${entry.label}`)
      qc.invalidateQueries({ queryKey: trpc.adminSeo.list.queryKey() })
    },
    onError: (err: any) => toast.error(err.message || "Lưu thất bại"),
  })

  function addKeyword() {
    const value = keywordInput.trim().replace(/^#/, "")
    if (!value || keywords.includes(value)) { setKeywordInput(""); return }
    setKeywords([...keywords, value])
    setKeywordInput("")
  }

  function save() {
    mut.mutate({
      key: entry.key,
      title: title.trim() || null,
      description: description.trim() || null,
      keywords,
      ogImage: ogImage.trim() || null,
    })
  }

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold">{entry.label}</h3>
            {entry.noIndex && (
              <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-600">noindex</span>
            )}
          </div>
          <code className="font-mono text-[11px] text-muted-foreground">{entry.path}</code>
        </div>
        <a href={entry.path} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-primary hover:underline">Xem trang</a>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={entry.defaultTitle} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]" />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Description</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder={entry.defaultDescription} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]" />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">OG Image (URL)</label>
        <input value={ogImage} onChange={(e) => setOgImage(e.target.value)} placeholder="https://..." className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm font-mono outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]" />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Keywords</label>
        <div className="flex gap-2">
          <input value={keywordInput} onChange={(e) => setKeywordInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addKeyword() } }} placeholder="Nhập từ khóa" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]" />
          <button type="button" onClick={addKeyword} className="rounded-md border px-3 text-sm font-medium hover:bg-accent">Thêm</button>
        </div>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {keywords.map((k) => (
            <button key={k} type="button" onClick={() => setKeywords(keywords.filter((x) => x !== k))} className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">#{k} x</button>
          ))}
        </div>
      </div>

      <button onClick={save} disabled={mut.isPending} className="h-9 w-full rounded-md bg-primary px-4 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50">
        {mut.isPending ? "Đang lưu..." : "Lưu"}
      </button>
    </div>
  )
}
