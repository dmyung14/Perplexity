import { useState } from "react"
import ReactMarkdown from "react-markdown"
import type { Exchange } from "@/lib/types"
import { AnswerTabs, type Tab } from "./AnswerTabs"
import { SourceCard } from "./SourceCard"
import { FollowUpChips } from "./FollowUpChips"

export function AnswerThread({
  exchanges,
  onFollowUp,
  anyStreaming,
}: {
  exchanges: Exchange[]
  onFollowUp: (question: string) => void
  anyStreaming: boolean
}) {
  return (
    <div className="flex flex-col gap-10">
      {exchanges.map((exchange) => (
        <ExchangeView
          key={exchange.id}
          exchange={exchange}
          onFollowUp={onFollowUp}
          anyStreaming={anyStreaming}
        />
      ))}
    </div>
  )
}

function ExchangeView({
  exchange,
  onFollowUp,
  anyStreaming,
}: {
  exchange: Exchange
  onFollowUp: (question: string) => void
  anyStreaming: boolean
}) {
  const [tab, setTab] = useState<Tab>("answer")

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-medium text-foreground">{exchange.query}</h2>

      <AnswerTabs active={tab} onChange={setTab} sourceCount={exchange.sources.length} />

      {tab === "answer" && (
        <div className="markdown-answer text-foreground">
          {exchange.error ? (
            <p className="text-destructive">{exchange.error}</p>
          ) : exchange.answerText ? (
            <ReactMarkdown>{exchange.answerText}</ReactMarkdown>
          ) : (
            <p className="text-muted-foreground">Thinking...</p>
          )}
        </div>
      )}

      {tab === "links" && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {exchange.sources.map((source, index) => (
            <SourceCard key={source.url} source={source} index={index} />
          ))}
        </div>
      )}

      {!anyStreaming && !exchange.error && (
        <FollowUpChips questions={exchange.followUps} onSelect={onFollowUp} />
      )}
    </div>
  )
}
