import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { getConversations, type ConversationSummary } from "@/lib/api"

type SidebarProps = {
  email: string
  activeConversationId: string | null
  onSelectConversation: (conversationId: string) => void
  onNewSearch: () => void
  onLogout: () => void
  refreshKey: number
}

export function Sidebar({
  email,
  activeConversationId,
  onSelectConversation,
  onNewSearch,
  onLogout,
  refreshKey,
}: SidebarProps) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([])

  useEffect(() => {
    getConversations()
      .then(setConversations)
      .catch(() => setConversations([]))
  }, [refreshKey])

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-border bg-card px-3 py-4">
      <div className="mb-6 flex items-center gap-2 px-2">
        <span className="text-lg font-semibold text-foreground">Perplexity</span>
      </div>

      <Button onClick={onNewSearch} className="mb-6 justify-start" variant="secondary">
        + New
      </Button>

      <nav className="mb-6 flex flex-col gap-1 text-sm text-muted-foreground">
        <SidebarItem label="Home" active />
        <SidebarItem label="Computer" />
        <SidebarItem label="Artifacts" />
        <SidebarItem label="Customize" />
      </nav>

      <div className="mb-2 px-2 text-xs font-medium tracking-wide text-muted-foreground">
        PROJECTS
      </div>
      <div className="mb-6 rounded-xl border border-dashed border-border px-3 py-4 text-xs text-muted-foreground">
        Organize and share your work. Keep files, memory, and context together across sessions.
      </div>

      <div className="mb-2 px-2 text-xs font-medium tracking-wide text-muted-foreground">
        SESSIONS
      </div>
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <p className="px-2 text-xs text-muted-foreground">No conversations yet</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {conversations.map((conversation) => (
              <li key={conversation.id}>
                <button
                  type="button"
                  onClick={() => onSelectConversation(conversation.id)}
                  className={`w-full truncate rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-accent ${
                    activeConversationId === conversation.id
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  {conversation.title ?? conversation.slug}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-border px-2 pt-4">
        <span className="truncate text-sm text-foreground">{email}</span>
        <button
          type="button"
          onClick={onLogout}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Logout
        </button>
      </div>
    </aside>
  )
}

function SidebarItem({ label, active }: { label: string; active?: boolean }) {
  return (
    <button
      type="button"
      className={`rounded-lg px-2 py-2 text-left transition-colors hover:bg-accent hover:text-foreground ${
        active ? "bg-accent text-foreground" : ""
      }`}
    >
      {label}
    </button>
  )
}
