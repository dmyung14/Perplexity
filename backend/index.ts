import express from "express"
import cors from "cors"
import { tavily } from "@tavily/core"
import dotenv from "dotenv"
import { Output, streamText } from "ai"
import { SYSTEM_PROMPT, PROMPT_TEMPLATE } from "./prompt.js"
import z from "zod"
import { prisma } from "./db.js"
import { middleware } from "./middleware.js"

dotenv.config()

const client = tavily({ apiKey: process.env.TAVILY_API_KEY! })
const app = express()

app.use(express.json())
app.use(cors())

app.post("/signup", async (req, res) => {
  const { email, provider, name } = req.body

  const user = await prisma.user.create({
    data: { email, provider, name }
  })

  res.json(user)
})

app.post("/signin", middleware, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId! }
  })

  res.json(user)
})

app.get("/conversation", middleware, async (req, res) => {
  const conversations = await prisma.conversation.findMany({
    where: { userId: req.userId! },
    select: { id: true, title: true, slug: true }
  })

  res.json(conversations)
})

app.post("/conversation/:conversationId", middleware, async (req, res) => {
  const conversationId = String(req.params.conversationId)

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId, userId: req.userId! },
    include: { messages: { orderBy: { createdAt: "asc" } } }
  })

  if (!conversation) {
    res.status(404).json({ message: "Conversation not found" })
    return
  }

  res.json(conversation)
})

app.post("/perplexity_ask", middleware, async (req, res) => {
  res.header('Cache-Control', 'no-cache')
  res.header('Content-Type', 'text/event-stream')

  // get the query from the user
  const query = req.body.query

  // make sure user has access/credits to hit the endpoint

  // check if we have web search indexed for a similar query

  // web search to gather resources
  const webSearchResponse = await client.search(query, {
    searchDepth: "advanced"
  })

  const webSearchResults = webSearchResponse.results

  // hit the LLM and stream back responses
  // use ai gateway vercel

  const prompt = PROMPT_TEMPLATE
    .replace("{{WEB_SEARCH_RESULTS}}", JSON.stringify(webSearchResults))
    .replace("{{USER_QUERY}}", query)

  const result = streamText({
    model: 'openai/gpt-5.4',
    prompt: prompt,
    system: SYSTEM_PROMPT,
  });

  for await (const textPart of result.textStream) {
    res.write(textPart)
  }

  res.write("\n-----SOURCES-----\n")
  // do some context engineering on the prompt + web search responses

  // stream back the sources and the follow up questions (which we can get from another parallel LLM call)
  res.write(JSON.stringify(webSearchResults.map(result => ({url: result.url}))))

  // close the event stream
  res.end()
})

app.post("/perplexity_ask/follow_up", middleware, async (req, res) => {
  res.header('Cache-Control', 'no-cache')
  res.header('Content-Type', 'text/event-stream')

  const { conversationId, query } = req.body

  // Step 1: get the existing chat from the db
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId, userId: req.userId! },
    include: { messages: { orderBy: { createdAt: "asc" } } }
  })

  if (!conversation) {
    res.status(404).json({ message: "Conversation not found" })
    return
  }

  // Step 2: Forward the full history to the LLM
  // Step 2.5: TODO: Do context engineering here
  const messages = [
    ...conversation.messages.map((message) => ({
      role: message.role === "User" ? ("user" as const) : ("assistant" as const),
      content: message.content
    })),
    { role: "user" as const, content: query }
  ]

  const result = streamText({
    model: 'openai/gpt-5.4',
    system: SYSTEM_PROMPT,
    messages,
  });

  // Step 3: Stream the response to the user
  let answer = ""
  for await (const textPart of result.textStream) {
    answer += textPart
    res.write(textPart)
  }

  await prisma.message.createMany({
    data: [
      { conversationId, role: "User", content: query },
      { conversationId, role: "Assistant", content: answer }
    ]
  })

  res.end()
})

app.listen(3001, () => {
  console.log(`Listening on port 3001`)
})