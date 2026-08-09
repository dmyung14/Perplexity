import { createClient } from "@/lib/supabase/client"
import { useEffect, useState } from "react"
import { useNavigate } from "react-router"
import type { User } from "@supabase/supabase-js"
import { Sidebar } from "@/components/layout/Sidebar"
import { AskBar } from "@/components/chat/AskBar"
import { AnswerThread } from "@/components/chat/AnswerThread"
import { AnswerStreamParser } from "@/lib/parseAnswerStream"
import { getConversation, streamAsk, streamFollowUp, type MessageRecord } from "@/lib/api"
import type { Exchange } from "@/lib/types"

const supabase = createClient()

export default function Dashboard() {
  const navigate = useNavigate()

  const [user, setUser] = useState<User | null>(null)
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [exchanges, setExchanges] = useState<Exchange[]>([])
  const [sidebarRefreshKey, setSidebarRefreshKey] = useState(0)

  useEffect(() => {
    async function fetchUser() {
      const { data, error } = await supabase.auth.getUser()
      if (error) {
        console.error("Error fetching user:", error)
      } else {
        setUser(data.user)
      }
    }
    fetchUser()
  }, [])

  function handleNewSearch() {
    setActiveConversationId(null)
    setExchanges([])
  }

  async function handleSelectConversation(conversationId: string) {
    try {
      const conversation = await getConversation(conversationId)
      setActiveConversationId(conversation.id)
      setExchanges(pairMessagesIntoExchanges(conversation.messages))
    } catch {
      setActiveConversationId(null)
      setExchanges([
        {
          id: crypto.randomUUID(),
          query: "",
          answerText: "",
          followUps: [],
          sources: [],
          streaming: false,
          error: "Conversation not found",
        },
      ])
    }
  }

  async function runExchange(query: string) {
    const id = crypto.randomUUID()
    const parser = new AnswerStreamParser()

    setExchanges((prev) => [
      ...prev,
      { id, query, answerText: "", followUps: [], sources: [], streaming: true, error: null },
    ])

    function updateExchange(patch: Partial<Exchange>) {
      setExchanges((prev) =>
        prev.map((exchange) => (exchange.id === id ? { ...exchange, ...patch } : exchange))
      )
    }

    try {
      const onChunk = (chunk: string) => {
        const parsed = parser.push(chunk)
        updateExchange({
          answerText: parsed.answerText,
          followUps: parsed.followUps,
          sources: parsed.sources ?? [],
        })
      }

      if (activeConversationId) {
        await streamFollowUp(activeConversationId, query, onChunk)
        setSidebarRefreshKey((key) => key + 1)
      } else {
        await streamAsk(query, onChunk)
      }

      updateExchange({ streaming: false })
    } catch (error) {
      updateExchange({
        streaming: false,
        error: error instanceof Error ? error.message : "Something went wrong",
      })
    }
  }

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <button
          onClick={() => navigate("/auth")}
          className="rounded-xl bg-primary px-4 py-2 text-primary-foreground"
        >
          Sign in
        </button>
      </div>
    )
  }

  const anyStreaming = exchanges.some((exchange) => exchange.streaming)

  return (
    <div className="flex h-screen bg-background text-foreground">
      <Sidebar
        email={user.email ?? ""}
        activeConversationId={activeConversationId}
        onSelectConversation={handleSelectConversation}
        onNewSearch={handleNewSearch}
        onLogout={() => {
          supabase.auth.signOut()
          setUser(null)
        }}
        refreshKey={sidebarRefreshKey}
      />

      <main className="flex flex-1 flex-col overflow-y-auto">
        {exchanges.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6">
            <h1 className="text-3xl font-semibold text-foreground">Ask anything</h1>
            <div className="w-full max-w-2xl">
              <AskBar onSubmit={runExchange} autoFocus />
            </div>
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-6 py-10">
            <AnswerThread exchanges={exchanges} onFollowUp={runExchange} anyStreaming={anyStreaming} />
            <div className="sticky bottom-6">
              <AskBar
                onSubmit={runExchange}
                disabled={anyStreaming}
                placeholder="Ask a follow-up..."
              />
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

function pairMessagesIntoExchanges(messages: MessageRecord[]): Exchange[] {
  const exchanges: Exchange[] = []

  for (const message of messages) {
    if (message.role === "User") {
      exchanges.push({
        id: crypto.randomUUID(),
        query: message.content,
        answerText: "",
        followUps: [],
        sources: [],
        streaming: false,
        error: null,
      })
    } else if (message.role === "Assistant") {
      const currentExchange = exchanges[exchanges.length - 1]
      if (!currentExchange) continue

      const parsed = new AnswerStreamParser().push(message.content)
      currentExchange.answerText = parsed.answerText
      currentExchange.followUps = parsed.followUps
      currentExchange.sources = parsed.sources ?? []
    }
  }

  return exchanges
}
