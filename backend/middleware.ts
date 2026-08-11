import type { NextFunction, Request, Response } from "express";
import { createSupabaseClient } from "./client.js";
import { prisma } from "./db.js";


const client = createSupabaseClient()

export async function middleware(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization

  const data = await client.auth.getUser(token)
  const user = data.data.user

  if (user?.id && user.email) {
    try {
      await prisma.user.create({
        data: {
          id: user.id,
          supabaseId: user.id,
          email: user.email,
          provider: user.app_metadata.provider === 'google' ? 'Google' : "Github",
          name: user.user_metadata.full_name
        }
      })
    } catch (e) {
      console.log(e)
    }
    req.userId = user.id
    next()
  } else {
    res.status(403).json({ message: "Incorrect inputs" })
  }
}