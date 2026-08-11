# Perplexity-clone Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Perplexity-style ask/answer UI (dark theme, sidebar with conversation history, streaming answers with sources and follow-up suggestions) on top of the existing backend, with no backend changes.

**Architecture:** A theme layer (CSS variables) underpins existing shadcn-style components. A pure `AnswerStreamParser` turns the backend's raw tagged text stream into structured `{answerText, followUps, sources}`. `lib/api.ts` wraps all four backend endpoints (axios for JSON calls, native `fetch` + `ReadableStream` for the two streaming endpoints). `Dashboard.tsx` becomes the app shell, holding all UI state (`useState`/`useEffect`, no new state library) and composing `Sidebar` + `AskBar` + `AnswerThread`.

**Tech Stack:** React 19, Vite, TypeScript, Tailwind CSS v4, `axios` (existing), `react-markdown` (new), Supabase JS client (existing).

## Global Constraints

- No git repository exists in this project (confirmed: `git status` fails). Every task ends with "mark the checkbox done" instead of a `git commit` step.
- No test framework is configured for the frontend (no vitest/jest) and none should be added as part of this plan. Verify each task with `npx tsc --noEmit` (run from `frontend/`) for type correctness; the final task does one end-to-end manual/browser check of the whole flow.
- Dark mode only — no light theme, per explicit instruction.
- One new dependency is pre-approved: `react-markdown` (installed in Task 7, the only task that needs it). No other new dependencies.
- No backend changes. `POST /perplexity_ask` does not persist a conversation — that's accepted (see design doc amendment); fresh questions are ephemeral, client-side-only threads.
- All new frontend files use the `@/*` → `frontend/src/*` path alias already configured in `tsconfig.app.json` and `vite.config.ts`, matching the existing `@/lib/utils` / `@/components/ui/button` usage.
- `tsconfig.app.json` has `"erasableSyntaxOnly": true` and `"verbatimModuleSyntax": true` — no enums, no constructor parameter properties, and all type-only imports/exports must use the `type` keyword (e.g. `import { getConversations, type ConversationSummary } from "@/lib/api"`).
- Auth logic (`Auth.tsx`, the `fetchUser` effect and sign-in gate in `Dashboard.tsx`) is already implemented and must not be changed — only the "signed in" render branch of `Dashboard.tsx` is replaced.

---

### Task 1: Theme tokens

**Files:**
- Modify: `frontend/src/index.css`

**Interfaces:**
- Produces: CSS variables (`--background`, `--foreground`, `--card`, `--card-foreground`, `--popover`, `--popover-foreground`, `--primary`, `--primary-foreground`, `--secondary`, `--secondary-foreground`, `--muted`, `--muted-foreground`, `--accent`, `--accent-foreground`, `--destructive`, `--border`, `--input`, `--ring`, `--radius`) and the Tailwind `@theme inline` color/radius mappings that make `bg-background`, `text-foreground`, `bg-primary`, etc. resolve — consumed by every component in this plan and already expected by `frontend/src/components/ui/button.tsx`. Also produces a `.markdown-answer` utility class for rendered answer text (used in Task 7).

- [ ] **Step 1: Write the new `index.css`**

```css
@import "tailwindcss";

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}

:root {
  --background: #191a1a;
  --foreground: #e8e6e3;
  --card: #202222;
  --card-foreground: #e8e6e3;
  --popover: #202222;
  --popover-foreground: #e8e6e3;
  --primary: #20808d;
  --primary-foreground: #ffffff;
  --secondary: #2a2c2c;
  --secondary-foreground: #e8e6e3;
  --muted: #262828;
  --muted-foreground: #9a9c9c;
  --accent: #2a2c2c;
  --accent-foreground: #e8e6e3;
  --destructive: #e35555;
  --border: #333535;
  --input: #333535;
  --ring: #20808d;
  --radius: 0.625rem;
}

body {
  background-color: var(--background);
  color: var(--foreground);
}

.markdown-answer :is(h1, h2, h3) {
  margin-top: 1em;
  margin-bottom: 0.5em;
  font-weight: 600;
}

.markdown-answer p {
  margin-bottom: 0.75em;
  line-height: 1.7;
}

.markdown-answer ul,
.markdown-answer ol {
  margin-bottom: 0.75em;
  padding-left: 1.5em;
}

.markdown-answer li {
  margin-bottom: 0.25em;
}

.markdown-answer a {
  color: var(--primary);
  text-decoration: underline;
}

.markdown-answer code {
  background-color: var(--muted);
  border-radius: 4px;
  padding: 0.1em 0.35em;
  font-size: 0.9em;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd frontend && npm run dev`
Expected: Vite starts cleanly (`Local: http://localhost:5173/`), no PostCSS/Tailwind error in the terminal. Leave this running — later tasks rely on HMR to reflect changes live.

- [ ] **Step 3: Mark this task's checkbox done**

---

### Task 2: Shared types and the answer-stream parser

**Files:**
- Create: `frontend/src/lib/types.ts`
- Create: `frontend/src/lib/parseAnswerStream.ts`

**Interfaces:**
- Consumes: nothing (pure, no dependencies on other new files)
- Produces:
  - `types.ts`: `export type Source = { url: string }`, `export type Exchange = { id: string; query: string; answerText: string; followUps: string[]; sources: Source[]; streaming: boolean; error: string | null }` — consumed by `api.ts`, `Sidebar.tsx`, `AnswerThread.tsx`, `SourceCard.tsx`, `FollowUpChips.tsx`, `Dashboard.tsx`.
  - `parseAnswerStream.ts`: `export class AnswerStreamParser { push(chunk: string): { answerText: string; followUps: string[]; sources: Source[] | null; done: boolean } }` — consumed by `Dashboard.tsx`.

- [ ] **Step 1: Write `frontend/src/lib/types.ts`**

```typescript
export type Source = {
  url: string
}

export type Exchange = {
  id: string
  query: string
  answerText: string
  followUps: string[]
  sources: Source[]
  streaming: boolean
  error: string | null
}
```

- [ ] **Step 2: Write `frontend/src/lib/parseAnswerStream.ts`**

```typescript
import type { Source } from "./types"

const SOURCES_SENTINEL = "\n-----SOURCES-----\n"

export type ParsedAnswer = {
  answerText: string
  followUps: string[]
  sources: Source[] | null
  done: boolean
}

export class AnswerStreamParser {
  private raw = ""

  push(chunk: string): ParsedAnswer {
    this.raw += chunk
    return this.parse()
  }

  private parse(): ParsedAnswer {
    const sentinelIndex = this.raw.indexOf(SOURCES_SENTINEL)
    const hasSentinel = sentinelIndex !== -1
    const llmText = hasSentinel ? this.raw.slice(0, sentinelIndex) : this.raw

    const answerMatch = llmText.match(/<ANSWER>([\s\S]*?)(<\/ANSWER>|$)/)
    const answerText = answerMatch ? answerMatch[1].trim() : ""

    const followUps: string[] = []
    const followUpsBlockMatch = llmText.match(/<FOLLOW_UPS>([\s\S]*?)<\/FOLLOW_UPS>/)
    if (followUpsBlockMatch) {
      const questionRegex = /<question>([\s\S]*?)<\/question>/g
      let match: RegExpExecArray | null
      while ((match = questionRegex.exec(followUpsBlockMatch[1])) !== null) {
        followUps.push(match[1].trim())
      }
    }

    let sources: Source[] | null = null
    if (hasSentinel) {
      const sourcesJson = this.raw.slice(sentinelIndex + SOURCES_SENTINEL.length).trim()
      if (sourcesJson.length > 0) {
        try {
          sources = JSON.parse(sourcesJson)
        } catch {
          sources = null
        }
      }
    }

    return { answerText, followUps, sources, done: hasSentinel && sources !== null }
  }
}
```

- [ ] **Step 3: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors mentioning `types.ts` or `parseAnswerStream.ts`.

- [ ] **Step 4: Manually sanity-check the parser logic**

Temporarily paste this into the browser DevTools console at `http://localhost:5173` (the dev server from Task 1) to confirm the regex logic before it's wired into the UI — it's plain JS so it runs standalone without imports:

```javascript
(() => {
  const SENTINEL = "\n-----SOURCES-----\n"
  const raw = "<ANSWER>\nHello world\n</ANSWER>\n\n<FOLLOW_UPS>\n<question>Q1?</question>\n<question>Q2?</question>\n</FOLLOW_UPS>\n" + SENTINEL + JSON.stringify([{ url: "https://example.com" }])
  const answerMatch = raw.match(/<ANSWER>([\s\S]*?)(<\/ANSWER>|$)/)
  console.log("answerText:", answerMatch[1].trim())
  const followUpsBlock = raw.match(/<FOLLOW_UPS>([\s\S]*?)<\/FOLLOW_UPS>/)
  const qs = [...followUpsBlock[1].matchAll(/<question>([\s\S]*?)<\/question>/g)].map(m => m[1].trim())
  console.log("followUps:", qs)
  const sentinelIndex = raw.indexOf(SENTINEL)
  console.log("sources:", JSON.parse(raw.slice(sentinelIndex + SENTINEL.length).trim()))
})()
```

Expected console output: `answerText: Hello world`, `followUps: ["Q1?", "Q2?"]`, `sources: [{url: "https://example.com"}]`.

- [ ] **Step 5: Mark this task's checkbox done**

---

### Task 3: API client

**Files:**
- Create: `frontend/src/lib/api.ts`

**Interfaces:**
- Consumes: `createClient` from `frontend/src/lib/supabase/client.ts` (existing), `BACKEND_URL` from `frontend/src/lib/config.ts` (existing)
- Produces:
  - `export type ConversationSummary = { id: string; title: string | null; slug: string }`
  - `export type MessageRecord = { id: number; role: "User" | "Assistant"; content: string; conversationId: string; createdAt: string }`
  - `export type ConversationDetail = ConversationSummary & { messages: MessageRecord[] }`
  - `export function getConversations(): Promise<ConversationSummary[]>`
  - `export function getConversation(conversationId: string): Promise<ConversationDetail>`
  - `export function streamAsk(query: string, onChunk: (chunk: string) => void): Promise<void>`
  - `export function streamFollowUp(conversationId: string, query: string, onChunk: (chunk: string) => void): Promise<void>`
  - All consumed by `Sidebar.tsx` and `Dashboard.tsx` in later tasks.

- [ ] **Step 1: Write `frontend/src/lib/api.ts`**

```typescript
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
```

- [ ] **Step 2: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors mentioning `api.ts`.

- [ ] **Step 3: Mark this task's checkbox done**

---

### Task 4: Chat leaf components — AskBar, SourceCard, FollowUpChips, AnswerTabs

**Files:**
- Create: `frontend/src/components/chat/AskBar.tsx`
- Create: `frontend/src/components/chat/SourceCard.tsx`
- Create: `frontend/src/components/chat/FollowUpChips.tsx`
- Create: `frontend/src/components/chat/AnswerTabs.tsx`

**Interfaces:**
- Consumes: `Source` type from `@/lib/types` (Task 2)
- Produces:
  - `AskBar`: `export function AskBar(props: { onSubmit: (query: string) => void; disabled?: boolean; placeholder?: string; autoFocus?: boolean }): JSX.Element`
  - `SourceCard`: `export function SourceCard(props: { source: Source; index: number }): JSX.Element`
  - `FollowUpChips`: `export function FollowUpChips(props: { questions: string[]; onSelect: (question: string) => void }): JSX.Element | null`
  - `AnswerTabs`: `export type Tab = "answer" | "links" | "images"`, `export function AnswerTabs(props: { active: Tab; onChange: (tab: Tab) => void; sourceCount: number }): JSX.Element`
  - All four consumed by `AnswerThread.tsx` (Task 5) and `Dashboard.tsx` (Task 6).

- [ ] **Step 1: Write `frontend/src/components/chat/AskBar.tsx`**

```tsx
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
```

- [ ] **Step 2: Write `frontend/src/components/chat/SourceCard.tsx`**

```tsx
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
```

- [ ] **Step 3: Write `frontend/src/components/chat/FollowUpChips.tsx`**

```tsx
export function FollowUpChips({
  questions,
  onSelect,
}: {
  questions: string[]
  onSelect: (question: string) => void
}) {
  if (questions.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-muted-foreground">Follow-up</span>
      {questions.map((question) => (
        <button
          key={question}
          type="button"
          onClick={() => onSelect(question)}
          className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-left text-sm text-foreground transition-colors hover:bg-accent"
        >
          {question}
          <span className="text-muted-foreground">+</span>
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Write `frontend/src/components/chat/AnswerTabs.tsx`**

```tsx
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
```

- [ ] **Step 5: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors mentioning any of the four new files.

- [ ] **Step 6: Mark this task's checkbox done**

---

### Task 5: AnswerThread (installs react-markdown)

**Files:**
- Create: `frontend/src/components/chat/AnswerThread.tsx`
- Modify: `frontend/package.json` (via `npm install`, not by hand)

**Interfaces:**
- Consumes: `Exchange` from `@/lib/types` (Task 2), `AnswerTabs`/`type Tab` from `./AnswerTabs`, `SourceCard` from `./SourceCard`, `FollowUpChips` from `./FollowUpChips` (all Task 4)
- Produces: `export function AnswerThread(props: { exchanges: Exchange[]; onFollowUp: (question: string) => void }): JSX.Element` — consumed by `Dashboard.tsx` (Task 6)

- [ ] **Step 1: Install the new dependency**

Run: `cd frontend && npm install react-markdown`
Expected: `react-markdown` added to `frontend/package.json` dependencies, install succeeds with 0 vulnerabilities (or only pre-existing ones).

- [ ] **Step 2: Write `frontend/src/components/chat/AnswerThread.tsx`**

```tsx
import { useState } from "react"
import ReactMarkdown from "react-markdown"
import type { Exchange } from "@/lib/types"
import { AnswerTabs, type Tab } from "./AnswerTabs"
import { SourceCard } from "./SourceCard"
import { FollowUpChips } from "./FollowUpChips"

export function AnswerThread({
  exchanges,
  onFollowUp,
}: {
  exchanges: Exchange[]
  onFollowUp: (question: string) => void
}) {
  return (
    <div className="flex flex-col gap-10">
      {exchanges.map((exchange) => (
        <ExchangeView key={exchange.id} exchange={exchange} onFollowUp={onFollowUp} />
      ))}
    </div>
  )
}

function ExchangeView({
  exchange,
  onFollowUp,
}: {
  exchange: Exchange
  onFollowUp: (question: string) => void
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

      {!exchange.streaming && !exchange.error && (
        <FollowUpChips questions={exchange.followUps} onSelect={onFollowUp} />
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors mentioning `AnswerThread.tsx`.

- [ ] **Step 4: Mark this task's checkbox done**

---

### Task 6: Sidebar

**Files:**
- Create: `frontend/src/components/layout/Sidebar.tsx`

**Interfaces:**
- Consumes: `getConversations`, `type ConversationSummary` from `@/lib/api` (Task 3), `Button` from `@/components/ui/button` (existing)
- Produces: `export function Sidebar(props: { email: string; activeConversationId: string | null; onSelectConversation: (conversationId: string) => void; onNewSearch: () => void; onLogout: () => void; refreshKey: number }): JSX.Element` — consumed by `Dashboard.tsx` (Task 7)

- [ ] **Step 1: Write `frontend/src/components/layout/Sidebar.tsx`**

```tsx
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
```

- [ ] **Step 2: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors mentioning `Sidebar.tsx`.

- [ ] **Step 3: Mark this task's checkbox done**

---

### Task 7: Wire up Dashboard.tsx as the app shell

**Files:**
- Modify: `frontend/src/pages/Dashboard.tsx` (full rewrite of the "signed in" render branch; the `fetchUser` effect and sign-in gate are kept as-is)

**Interfaces:**
- Consumes: `Sidebar` (Task 6), `AskBar` (Task 4), `AnswerThread` (Task 5), `AnswerStreamParser` (Task 2), `getConversation`/`streamAsk`/`streamFollowUp` (Task 3), `Exchange` type (Task 2)
- Produces: the complete page component — nothing downstream consumes this directly, it's the top of the tree for the authenticated app

- [ ] **Step 1: Write the full `frontend/src/pages/Dashboard.tsx`**

```tsx
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
    const conversation = await getConversation(conversationId)
    setActiveConversationId(conversation.id)
    setExchanges(pairMessagesIntoExchanges(conversation.messages))
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
            <AnswerThread exchanges={exchanges} onFollowUp={runExchange} />
            <div className="sticky bottom-6">
              <AskBar
                onSubmit={runExchange}
                disabled={exchanges.some((exchange) => exchange.streaming)}
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
  for (let i = 0; i < messages.length; i += 2) {
    const userMessage = messages[i]
    const assistantMessage = messages[i + 1]
    if (!userMessage) continue
    exchanges.push({
      id: crypto.randomUUID(),
      query: userMessage.content,
      answerText: assistantMessage?.content ?? "",
      followUps: [],
      sources: [],
      streaming: false,
      error: null,
    })
  }
  return exchanges
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: zero errors across the whole project.

- [ ] **Step 3: Mark this task's checkbox done**

---

### Task 8: End-to-end verification

**Files:** none (verification only)

**Interfaces:** none

- [ ] **Step 1: Confirm both servers are running**

Backend: `cd backend && npm run dev` (should already be running per prior work in this session — confirm with `Listening on port 3001` in its terminal).
Frontend: `cd frontend && npm run dev` (started in Task 1) — confirm `Local: http://localhost:5173/`.

- [ ] **Step 2: Walk the golden path in a real browser**

Navigate to `http://localhost:5173/`. Expected, in order:
1. If not logged in, the centered "Sign in" button appears (dark background, teal button) — click it, complete Google/GitHub OAuth, land back on `/`.
2. The app shell renders: dark sidebar on the left (logo, "+ New", Home/Computer/Artifacts/Customize, Projects placeholder, "No conversations yet" under Sessions, email + Logout at the bottom) and a centered "Ask anything" input on the right.
3. Type a question and submit. Expected: the view swaps to a thread — the question as a heading, an Answer/Links/Images tab bar, streamed markdown text appearing progressively under "Answer" (no literal `<ANSWER>` tags visible), and once streaming finishes, follow-up suggestion chips appear below.
4. Click the "Links" tab. Expected: a grid of source cards (hostname + full URL), not raw JSON.
5. Click a follow-up chip. Expected: a second exchange is appended below the first, using the chip's text as the new question, and it streams the same way.
6. Click "+ New" in the sidebar. Expected: the thread clears and the centered "Ask anything" input returns.
7. Click "Logout" in the sidebar. Expected: returns to the signed-out state.

- [ ] **Step 3: Fix any visual or functional issue found in Step 2 before considering this plan complete**

- [ ] **Step 4: Mark this task's checkbox done**
