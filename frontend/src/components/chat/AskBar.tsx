import { useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"

type AskBarProps = {
  onSubmit: (query: string) => void
  disabled?: boolean
  placeholder?: string
  autoFocus?: boolean
}

export function AskBar({ onSubmit, disabled, placeholder, autoFocus }: AskBarProps) {
  const [value, setValue] = useState("")

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSubmit(trimmed)
    setValue("")
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 shadow-sm"
    >
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        disabled={disabled}
        autoFocus={autoFocus}
        placeholder={placeholder ?? "Ask anything..."}
        className="flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground disabled:opacity-50"
      />
      <Button type="submit" size="sm" disabled={disabled || value.trim().length === 0}>
        Ask
      </Button>
    </form>
  )
}
