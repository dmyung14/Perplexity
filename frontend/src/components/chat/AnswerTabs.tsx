import type { ReactNode } from "react"

export type Tab = "answer" | "links" | "images"

type AnswerTabsProps = {
  active: Tab
  onChange: (tab: Tab) => void
  sourceCount: number
}

export function AnswerTabs({ active, onChange, sourceCount }: AnswerTabsProps) {
  return (
    <div className="mb-4 flex gap-4 border-b border-border text-sm">
      <TabButton active={active === "answer"} onClick={() => onChange("answer")}>
        Answer
      </TabButton>
      <TabButton active={active === "links"} onClick={() => onChange("links")}>
        Links{sourceCount > 0 ? ` · ${sourceCount}` : ""}
      </TabButton>
      <TabButton active={false} onClick={() => {}} disabled>
        Images
      </TabButton>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  disabled,
  children,
}: {
  active: boolean
  onClick: () => void
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`-mb-px border-b-2 px-1 pb-2 font-medium transition-colors ${
        active
          ? "border-primary text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground"
      } ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
    >
      {children}
    </button>
  )
}
