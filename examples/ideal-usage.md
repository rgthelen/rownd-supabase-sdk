# Ideal Usage Example

This example shows how simple it is to integrate Rownd with Supabase using our SDKs.

## Frontend (React App)

```typescript
// App.tsx
import { createClient } from '@rownd/supabase-js'  // ← Only change from standard Supabase
import { useRownd } from '@rownd/react'
import { useState, useEffect } from 'react'

const SUPABASE_URL = 'https://your-project.supabase.co'
const SUPABASE_ANON_KEY = 'your-anon-key'

function App() {
  const { getAccessToken, user } = useRownd()
  const [todos, setTodos] = useState([])
  
  // Create Supabase client with Rownd auth
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { 
    getAccessToken  // ← Pass the token getter
  })

  useEffect(() => {
    if (user) {
      loadTodos()
    }
  }, [user])

  async function loadTodos() {
    // Works exactly like standard Supabase!
    const { data } = await supabase
      .from('todos')
      .select('*')
      .order('created_at', { ascending: false })
    
    setTodos(data || [])
  }

  async function addTodo(title: string) {
    const { data } = await supabase
      .from('todos')
      .insert({ title })
      .select()
      .single()
    
    if (data) {
      setTodos([data, ...todos])
    }
  }

  async function toggleTodo(id: string, completed: boolean) {
    await supabase
      .from('todos')
      .update({ completed })
      .eq('id', id)
    
    loadTodos()
  }

  if (!user) {
    return <div>Please sign in</div>
  }

  return (
    <div>
      <h1>My Todos</h1>
      {/* Todo UI here */}
    </div>
  )
}
```

## Backend (Edge Function)

```typescript
// supabase/functions/get-user-stats/index.ts
import { serve } from '@rownd/supabase-edge'  // ← Only change from standard Deno.serve

serve(async (req, { userId, supabase }) => {
  // userId is automatically provided and validated!
  
  // Get user's todo stats
  const { data: todos } = await supabase
    .from('todos')
    .select('completed')
    .eq('user_id', userId)
  
  const total = todos?.length || 0
  const completed = todos?.filter(t => t.completed).length || 0
  
  return new Response(
    JSON.stringify({
      total,
      completed,
      pending: total - completed
    }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
```

## That's It! 🎉

With just these minimal changes:
- **Frontend**: Changed import + added `getAccessToken`
- **Backend**: Changed import only

You get:
- ✅ Automatic token validation
- ✅ User isolation
- ✅ All Supabase features working seamlessly
- ✅ No manual token handling
- ✅ No custom proxy code
- ✅ No CORS configuration

Compare this to the 700+ lines of integration code needed without the SDK! 