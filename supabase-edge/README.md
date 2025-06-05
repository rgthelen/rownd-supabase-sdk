# @rownd/supabase-edge

Simplified Rownd authentication for Supabase Edge Functions.

## Installation

Since Supabase Edge Functions use Deno, you'll import this directly from a URL:

```typescript
import { createRowndHandler } from 'https://esm.sh/@rownd/supabase-edge@1.0.0/simplified'
```

## Usage

### Basic Example

```typescript
// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createRowndHandler } from 'https://esm.sh/@rownd/supabase-edge@1.0.0/simplified'

createRowndHandler(async (req, { userId, supabase }) => {
  // userId is automatically extracted from the Rownd token
  // supabase client is pre-configured with service role
  
  const { data, error } = await supabase
    .from('todos')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error

  return { todos: data }
})
```

### With Request Body

```typescript
createRowndHandler(async (req, { userId, supabase }) => {
  const { task } = await req.json()
  
  if (!task || task.trim() === '') {
    throw new Error('Task is required')
  }

  const { data: todo, error } = await supabase
    .from('todos')
    .insert({ user_id: userId, task })
    .select()
    .single()

  if (error) throw error

  return { todo }
})
```

### With Custom CORS

```typescript
createRowndHandler(async (req, { userId, supabase, token }) => {
  // Access full token payload if needed
  console.log('User email:', token.email)
  
  // Your logic here
  return { message: 'Success' }
}, {
  corsOrigin: 'https://yourdomain.com',
  additionalHeaders: ['x-custom-header']
})
```

## Features

- **Automatic Token Validation**: Validates Rownd JWTs using JWKS
- **User ID Extraction**: Automatically extracts userId from token
- **Supabase Client**: Pre-configured with service role credentials
- **CORS Handling**: Built-in CORS support with customization
- **Error Handling**: Consistent error responses
- **TypeScript Support**: Full type definitions

## How It Works

1. Extracts `X-Rownd-Token` header from request
2. Validates the JWT using Rownd's public keys
3. Provides userId and configured Supabase client to your handler
4. Handles CORS and error responses automatically

## Context Object

Your handler receives a context object with:

- `userId`: The authenticated user's ID (from token `sub` claim)
- `token`: The full decoded token payload
- `supabase`: Configured Supabase client with service role
- `request`: The original Request object

## Manual Token Validation

If you need more control, you can use the validation function directly:

```typescript
import { validateRowndToken } from 'https://esm.sh/@rownd/supabase-edge@1.0.0/simplified'

Deno.serve(async (req) => {
  try {
    const tokenPayload = await validateRowndToken(req)
    const userId = tokenPayload.user_id
    
    // Your custom logic here
  } catch (error) {
    // Handle error
  }
})
``` 