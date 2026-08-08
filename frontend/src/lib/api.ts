import axios from "axios"
import { createClient } from "@/lib/supabase/client"
import { BACKEND_URL } from "@/lib/config"

const supabase = createClient()

export type ConversationSummary = {
  id: string
  title: string | null
  slug: string
}

export type MessageRecord = {
  id: number
  role: "User" | "Assistant"
  content: string
  conversationId: string
  createdAt: string
}

export type ConversationDetail = ConversationSummary & {
  messages: MessageRecord[]
}

async function authHeader(): Promise<{ Authorization: string }> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  return { Authorization: session?.access_token ?? "" }
}

export async function getConversations(): Promise<ConversationSummary[]> {
  const headers = await authHeader()
  const response = await axios.get(`${BACKEND_URL}/conversation`, { headers })
  return response.data
}

export async function getConversation(conversationId: string): Promise<ConversationDetail> {
  const headers = await authHeader()
  const response = await axios.post(
    `${BACKEND_URL}/conversation/${conversationId}`,
    {},
    { headers }
  )
  return response.data
}

async function streamRequest(
  path: string,
  body: Record<string, unknown>,
  onChunk: (chunk: string) => void
): Promise<void> {
  const headers = await authHeader()
  const response = await fetch(`${BACKEND_URL}${path}`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

  if (!response.ok || !response.body) {
    throw new Error(`Request to ${path} failed with status ${response.status}`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    onChunk(decoder.decode(value, { stream: true }))
  }
}

export function streamAsk(query: string, onChunk: (chunk: string) => void): Promise<void> {
  return streamRequest("/perplexity_ask", { query }, onChunk)
}

export function streamFollowUp(
  conversationId: string,
  query: string,
  onChunk: (chunk: string) => void
): Promise<void> {
  return streamRequest("/perplexity_ask/follow_up", { conversationId, query }, onChunk)
}
