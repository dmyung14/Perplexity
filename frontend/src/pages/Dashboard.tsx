import { createClient } from "@/lib/supabase/client"
import { useState, useEffect } from "react"
import { useNavigate } from "react-router"
import type { User } from "@supabase/supabase-js"
import axios from 'axios'
import { BACKEND_URL } from "@/lib/config"

const supabase = createClient()

export default function Dashboard() {

  const navigate = useNavigate()

  const [ user, setUser ] = useState<User | null>(null)

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

  useEffect(() => {
    async function getExistingConversations() {
      if (!user) return

      const { data: { session } } = await supabase.auth.getSession()
      const jwt = session?.access_token
      const response = await axios.get(`${BACKEND_URL}/conversation`, {
        headers: {
          Authorization: jwt
        }
      })

      console.log(response.data)
    }
    getExistingConversations()
  }, [user])

  return (
    <div>
      {!user && <button onClick={() => navigate("/auth")}>
        Sign in</button>}

      {user && <div>
        {user?.email}
        <button onClick={() => {
          supabase.auth.signOut()
          setUser(null)
        }}>
          Logout
        </button>
      </div>}
    </div>
  )
}