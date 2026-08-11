# Perplexity-clone frontend — design

## Context

Backend (already implemented) exposes:
- `POST /signin` — verify Supabase token, upsert + return user (via `middleware`)
- `GET /conversation` — list the current user's conversations (`id`, `title`, `slug`)
- `POST /conversation/:conversationId` — fetch one conversation with its ordered messages
- `POST /perplexity_ask` — web search + streamed LLM answer. Streams raw text containing
  `<ANSWER>...</ANSWER>` and `<FOLLOW_UPS><question>...</question>...</FOLLOW_UPS>` tags (the
  model's literal output, unparsed), then after the stream ends appends
  `\n-----SOURCES-----\n` + `JSON.stringify([{url}, ...])`
- `POST /perplexity_ask/follow_up` — same streaming shape, scoped to an existing conversation,
  and persists the new user query + assistant answer as `Message` rows

Frontend currently has only `Auth.tsx` (Supabase OAuth login, done, not touched) and a stub
`Dashboard.tsx` (auth-gate + bare sign-out button). No theme tokens are defined in `index.css`
yet, even though `components/ui/button.tsx` already references shadcn CSS variables
(`--primary`, `--background`, etc.).

Goal: build the rest of the frontend to look and feel close to Perplexity, dark mode by
default, reusing the existing backend as-is (no backend changes in this pass).

## Scope

**In scope:**
- Dark theme (Perplexity-like: charcoal background, teal/turquoise accent)
- App shell: sidebar (nav placeholders + real conversation history) + main content
- Ask flow: input → streamed answer rendered as markdown → source links → follow-up
  suggestion chips → follow-up input that continues the same conversation
- Conversation history: list past conversations, click to load full thread

**Out of scope (explicitly, per user decision):**
- "Images" tab — disabled placeholder (Tavily image results aren't wired into the backend
  response; would require a backend change)
- "Computer" / "Artifacts" / "Customize" / "Projects" sidebar sections — visual-only
  placeholders, no backing functionality
- Any backend modification

## Architecture

```
frontend/src/
  index.css                       — shadcn CSS variable theme (dark only)
  lib/
    api.ts                        — axios instance + typed calls to all 4 endpoints
    parseAnswerStream.ts          — parses the raw stream into {answerText, followUps, sources}
  components/
    ui/button.tsx                 — existing, unchanged
    layout/
      Sidebar.tsx                 — logo, New button, nav placeholders, Sessions list, user menu
    chat/
      AskBar.tsx                  — input box, used both for fresh search and follow-ups
      AnswerThread.tsx            — renders one exchange: user query + assistant answer
      AnswerTabs.tsx              — Answer / Links / Images tab bar (Images disabled)
      SourceCard.tsx              — one source link card
      FollowUpChips.tsx           — clickable suggested follow-up buttons
  pages/
    Dashboard.tsx                 — auth-gate (existing logic kept) + renders the app shell
    Auth.tsx                      — existing, unchanged
  App.tsx                         — existing routes, unchanged
```

No new routes: the main area swaps client-side between an empty "ask something" state and
an active thread. State (current conversation, messages, loading) lives in `Dashboard.tsx`
and is passed down as props — no new state library needed for this scope.

## Streaming / parsing

`parseAnswerStream.ts` owns turning the backend's raw stream into renderable pieces:

1. Buffer raw chunks as they arrive from `fetch()`'s `ReadableStream` reader.
2. Split the accumulated buffer on the literal sentinel `\n-----SOURCES-----\n`:
   - Everything before it is the LLM's tagged output.
   - Everything after it (only complete once the stream ends) is `JSON.parse`-able into
     `{ url: string }[]`.
3. From the pre-sentinel text, regex-extract the contents of `<ANSWER>...</ANSWER>` for the
   live-updating answer body (if the closing tag hasn't arrived yet, take everything after
   `<ANSWER>` so far; if the opening tag hasn't arrived yet, show a loading state).
4. Once `<FOLLOW_UPS>` is present, regex-extract each `<question>...</question>` for the
   suggestion chips (only rendered after the stream completes, since partial questions aren't
   useful).

This keeps the raw-tag stream handling in one small, independently testable unit rather than
scattered through UI components.

## Rendering

Add `react-markdown` (new dependency, flagged for approval) to render the parsed answer text
as actual markdown (lists, bold, links) rather than a raw text blob — this is what makes
answers look like real Perplexity output rather than a wall of plain text.

## Error handling

- Fetch/stream failures (network error, non-2xx status) show an inline error state in the
  active thread with a retry affordance — no silent failures.
- `POST /conversation/:conversationId` returning 404 (not found / not owned) shows a "not
  found" state instead of an empty thread.

## Amendment (post-approval)

`POST /perplexity_ask` does not create a `Conversation` or persist any `Message` rows — only
`/perplexity_ask/follow_up` does, and it requires an *existing* conversation ID. Decided to
leave the backend untouched rather than add conversation-creation to `/perplexity_ask`. Concrete
effect on scope:

- Fresh questions (no prior conversation) are **ephemeral**: rendered as a client-side-only
  thread in React state, never saved. Follow-up chips on an ephemeral thread trigger a new
  `POST /perplexity_ask` call with the chip's question (each fresh ask, not true multi-turn
  context — `/perplexity_ask` takes no history).
- The sidebar "Sessions" list still calls the real `GET /conversation` (currently returns `[]`
  since nothing creates rows) and `POST /conversation/:conversationId` still works for any
  conversation that exists by other means.
- Opening a conversation from the sidebar is the only path with real multi-turn context: its
  follow-up input calls the real `POST /perplexity_ask/follow_up` against that conversation ID.

## Explicitly not doing

- No new state-management library (Redux/Zustand/react-query) — scope doesn't warrant it,
  existing `useState`/`useEffect` + `axios` pattern (already used in `Dashboard.tsx`) is kept.
- No backend changes.
- No light theme — dark mode only, per explicit instruction.
