import { Skeleton } from "@/components/ui/skeleton"

export default function RootLoading() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <div className="space-y-4 w-full max-w-md px-4">
        <Skeleton className="h-8 w-48 mx-auto" />
        <Skeleton className="h-4 w-64 mx-auto" />
        <Skeleton className="h-10 w-32 mx-auto rounded-lg" />
      </div>
    </div>
  )
}
