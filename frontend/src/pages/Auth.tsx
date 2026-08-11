import { createClient } from "@/lib/supabase/client"

const supabase = createClient()

export default function Auth() {

  async function login(provider: "google" | "github") {
    const {error} = await supabase.auth.signInWithOAuth({
      provider: provider
    });

    error ? alert("Error while signing in") : alert("Signed in")
  }

  return <div>
    <button onClick={() => login('google')}>Login with google</button>
    <button onClick={() => login('github')}>Login with github</button>
  </div>
}