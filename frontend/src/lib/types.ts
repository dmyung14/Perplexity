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
