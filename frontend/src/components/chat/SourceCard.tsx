import type { Source } from "@/lib/types"

export function SourceCard({ source, index }: { source: Source; index: number }) {
  let hostname = source.url
  try {
    hostname = new URL(source.url).hostname.replace("www.", "")
  } catch {
    // keep the raw url as a fallback if it doesn't parse
  }

  return (
    <a
      href={source.url}
      target="_blank"
      rel="noreferrer"
      className="flex flex-col gap-1 rounded-xl border border-border bg-card p-3 transition-colors hover:bg-accent"
    >
      <span className="text-xs text-muted-foreground">
        {index + 1} · {hostname}
      </span>
      <span className="truncate text-sm text-foreground">{source.url}</span>
    </a>
  )
}
