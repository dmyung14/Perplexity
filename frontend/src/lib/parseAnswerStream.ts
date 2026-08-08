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
