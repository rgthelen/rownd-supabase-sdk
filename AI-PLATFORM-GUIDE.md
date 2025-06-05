# Rownd + Supabase Integration for AI Platforms

This guide is specifically designed for AI-driven development platforms like Lovable, Cursor, and others that need to quickly integrate Rownd authentication with Supabase.

## 🚀 Quick Integration

### Option 1: Import Everything via NPM

```javascript
import { aiPlatform } from '@rownd/supabase-js'

// Get the complete proxy function code
const proxyCode = aiPlatform.proxyFunctionCode

// Get setup instructions
const setup = aiPlatform.setup

// Get code snippets
const snippets = aiPlatform.snippets

// Get complete example app structure
const exampleApp = aiPlatform.exampleApp
```

### Option 2: Direct Code Import

```javascript
import { PROXY_FUNCTION_CODE } from '@rownd/supabase-js'

// Use the proxy function code directly
console.log(PROXY_FUNCTION_CODE)
```

## 📋 Step-by-Step Integration

### 1. Frontend Setup

```typescript
// Replace standard Supabase import
import { createClient } from '@rownd/supabase-js'  // ← Changed
import { useRownd } from '@rownd/react'

// Create client with Rownd auth
const { getAccessToken } = useRownd()
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { getAccessToken }  // ← Added
)

// Use Supabase normally - no other changes needed!
const { data } = await supabase.from('todos').select('*')
```

### 2. Backend Setup

#### Step 2.1: Create the Universal Proxy Function

Create a new Edge Function at `supabase/functions/_rownd_universal_proxy/index.ts`:

```typescript
// Copy the entire PROXY_FUNCTION_CODE here
// You can get it from: import { PROXY_FUNCTION_CODE } from '@rownd/supabase-js'
```

Or programmatically:

```javascript
import { aiPlatform } from '@rownd/supabase-js'
import fs from 'fs'

// Write the proxy function
fs.writeFileSync(
  'supabase/functions/_rownd_universal_proxy/index.ts',
  aiPlatform.proxyFunctionCode
)
```

#### Step 2.2: Create Your Edge Functions

For any Edge Function, just change the import:

```typescript
// Instead of: import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { serve } from '@rownd/supabase-edge'  // ← Only change

serve(async (req, { userId, supabase }) => {
  // userId is automatically available!
  const { data } = await supabase
    .from('todos')
    .select('*')
    .eq('user_id', userId)
  
  return new Response(JSON.stringify({ data }))
})
```

## 🤖 AI Platform Integration Examples

### For Lovable

```javascript
// In your Lovable app configuration
import { aiPlatform } from '@rownd/supabase-js'

// Get all the files you need
const files = aiPlatform.exampleApp.files

// files contains:
// - 'src/lib/supabase.ts' - Frontend client setup
// - 'supabase/functions/_rownd_universal_proxy/index.ts' - Proxy function
// - 'supabase/functions/get-todos/index.ts' - Example Edge Function
// - 'supabase/migrations/001_create_todos.sql' - Database schema
```

### For Cursor/GitHub Copilot

```javascript
// Use snippets for quick code generation
import { aiPlatform } from '@rownd/supabase-js'

// Frontend client creation
console.log(aiPlatform.snippets.createClient)

// Simple Edge Function
console.log(aiPlatform.snippets.simpleEdgeFunction)

// CRUD Edge Function
console.log(aiPlatform.snippets.crudEdgeFunction)
```

## 📦 Complete Example App

Here's a complete Todo app structure with Rownd + Supabase:

### Frontend: `src/lib/supabase.ts`
```typescript
import { createClient } from '@rownd/supabase-js'
import { useRownd } from '@rownd/react'

const { getAccessToken } = useRownd()
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { getAccessToken }
)
```

### Frontend: `src/components/TodoList.tsx`
```typescript
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRownd } from '@rownd/react'

export function TodoList() {
  const { user } = useRownd()
  const [todos, setTodos] = useState([])

  useEffect(() => {
    if (user) loadTodos()
  }, [user])

  async function loadTodos() {
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
    
    if (data) setTodos([data, ...todos])
  }

  // Rest of component...
}
```

### Backend: `supabase/functions/get-todos/index.ts`
```typescript
import { serve } from '@rownd/supabase-edge'

serve(async (req, { userId, supabase }) => {
  const { data, error } = await supabase
    .from('todos')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  
  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }), 
      { status: 400 }
    )
  }
  
  return new Response(JSON.stringify({ data }))
})
```

## 🛠️ Programmatic Usage

### Generate Edge Function
```javascript
import { aiPlatform } from '@rownd/supabase-js'

const functionCode = aiPlatform.generateEdgeFunction('get-user-profile', `
serve(async (req, { userId, supabase }) => {
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .single()
  
  return new Response(JSON.stringify({ profile }))
})
`)

// Write to file
fs.writeFileSync('supabase/functions/get-user-profile/index.ts', functionCode)
```

### Get Setup Instructions
```javascript
import { aiPlatform } from '@rownd/supabase-js'

// Frontend setup steps
console.log(aiPlatform.setup.frontend.steps)

// Backend setup steps
console.log(aiPlatform.setup.backend.steps)
```

## 🎯 Key Benefits for AI Platforms

1. **Single Import**: Everything you need from one package
2. **Ready-to-Use Code**: Complete, working code snippets
3. **No Manual Setup**: Programmatically generate all files
4. **Type Safety**: Full TypeScript support
5. **Zero Learning Curve**: Uses standard Supabase API

## 📝 Summary

For AI platforms integrating Rownd + Supabase:

1. **Import**: `import { aiPlatform } from '@rownd/supabase-js'`
2. **Get Code**: Use `aiPlatform.proxyFunctionCode` for the proxy
3. **Generate**: Use `aiPlatform.generateEdgeFunction()` for functions
4. **Deploy**: Standard Supabase deployment

That's it! Your AI platform can now generate fully authenticated Supabase apps with Rownd in seconds. 