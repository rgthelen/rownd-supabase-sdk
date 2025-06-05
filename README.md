# Rownd + Supabase Integration SDKs

Seamlessly integrate Rownd authentication with your Supabase project using these drop-in replacement SDKs. Transform hundreds of lines of integration code into just 2-3 simple changes.

## 🚀 Quick Start

### Frontend SDK (`@rownd/supabase-js`)

**Before** (Standard Supabase):
```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(url, anonKey)
```

**After** (With Rownd) - Just 2 changes:
```typescript
import { createClient } from '@rownd/supabase-js'  // ← Change 1
import { useRownd } from '@rownd/react'

const { getAccessToken } = useRownd()
const supabase = createClient(url, anonKey, { getAccessToken }) // ← Change 2

// Use exactly the same! No other code changes needed
const { data } = await supabase.from('todos').select('*')
const { data } = await supabase.storage.from('avatars').upload('file.jpg', file)
const { data } = await supabase.functions.invoke('my-function')
```

### Backend SDK (`@rownd/supabase-edge`)

**Before** (Standard Edge Function):
```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (req) => {
  // Manual auth handling needed...
})
```

**After** (With Rownd) - Just 1 change:
```typescript
import { serve } from '@rownd/supabase-edge'  // ← Only change!

serve(async (req, { userId, supabase }) => {  // ← userId automatically provided
  // Your existing code works as-is!
  const { data } = await supabase
    .from('todos')
    .select('*')
    .eq('user_id', userId)
  
  return new Response(JSON.stringify({ data }))
})
```

## 📦 Installation

### Frontend
```bash
npm install @rownd/supabase-js
# or
yarn add @rownd/supabase-js
```

### Backend (Edge Functions)
```typescript
// Import directly in your Edge Function:
import { serve } from 'https://deno.land/x/rownd_supabase_edge/mod.ts'
```

## 🛠️ Setup

### Automatic Setup (Recommended)

When you first use the SDK, it will prompt you to run:

```bash
npx @rownd/supabase-js setup --url YOUR_SUPABASE_URL --service-key YOUR_SERVICE_KEY
```

This command:
1. Creates a universal proxy Edge Function
2. Configures it for your project
3. Provides deployment instructions

### Manual Setup

If you prefer manual setup, create an Edge Function named `_rownd_universal_proxy` with the code from our [proxy template](./templates/universal-proxy.ts).

## 🎯 Features

### Frontend SDK
- ✅ **Drop-in replacement** for `@supabase/supabase-js`
- ✅ **Automatic token injection** for all operations
- ✅ **Database operations** via secure proxy
- ✅ **Storage operations** with proper auth
- ✅ **Edge Function calls** with auth headers
- ✅ **RPC support** with user context
- ✅ **Full TypeScript support**
- ✅ **Auto-deployment** of proxy function

### Backend SDK
- ✅ **Drop-in replacement** for `Deno.serve`
- ✅ **Automatic token validation** using Rownd's JWKS
- ✅ **User ID extraction** from tokens
- ✅ **CORS handling** out of the box
- ✅ **Supabase client** pre-configured
- ✅ **Error handling** with proper status codes
- ✅ **TypeScript support** for better DX

## 📖 Usage Examples

### Frontend Examples

#### Database Operations
```typescript
// All standard Supabase operations work seamlessly
const { data: todos } = await supabase
  .from('todos')
  .select('*')
  .order('created_at', { ascending: false })

const { data: newTodo } = await supabase
  .from('todos')
  .insert({ title: 'New task', completed: false })
  .select()
  .single()

const { error } = await supabase
  .from('todos')
  .update({ completed: true })
  .eq('id', todoId)
```

#### Storage Operations
```typescript
// File uploads with automatic user isolation
const { data, error } = await supabase.storage
  .from('avatars')
  .upload('profile.jpg', file)

// Downloads work the same
const { data: file } = await supabase.storage
  .from('avatars')
  .download('profile.jpg')

// List files
const { data: files } = await supabase.storage
  .from('avatars')
  .list()
```

#### Edge Functions
```typescript
// Call Edge Functions with automatic auth
const { data, error } = await supabase.functions.invoke('send-email', {
  body: { to: 'user@example.com', subject: 'Hello!' }
})
```

### Backend Examples

#### Simple Edge Function
```typescript
import { serve } from '@rownd/supabase-edge'

serve(async (req, { userId, supabase }) => {
  // userId is automatically extracted from Rownd token
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .single()

  return new Response(JSON.stringify({ profile }))
})
```

#### With Request Body
```typescript
serve(async (req, { userId, supabase }) => {
  const { title } = await req.json()
  
  const { data, error } = await supabase
    .from('todos')
    .insert({ 
      title, 
      user_id: userId,
      created_at: new Date().toISOString()
    })
    .select()
    .single()

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400
    })
  }

  return new Response(JSON.stringify({ data }))
})
```

#### Access Full Token Payload
```typescript
serve(async (req, { userId, supabase, token }) => {
  // Access additional claims from the token if needed
  console.log('User email:', token.email)
  console.log('Token issued at:', new Date(token.iat * 1000))
  
  // Your logic here...
})
```

## 🔧 Configuration

### Frontend SDK Options

```typescript
const supabase = createClient(url, anonKey, {
  getAccessToken,      // Required: Function to get Rownd token
  autoSetup: true,     // Optional: Auto-deploy proxy (default: true)
})
```

### Backend SDK

The backend SDK works out of the box with zero configuration. It automatically:
- Validates tokens using Rownd's JWKS endpoint
- Extracts the user ID from the `sub` claim
- Sets up CORS headers
- Provides a configured Supabase client

## 🏗️ Architecture

### How It Works

1. **Frontend**: The SDK intercepts all Supabase operations and adds Rownd authentication tokens
2. **Proxy Function**: A universal Edge Function validates tokens and forwards requests to Supabase
3. **Backend**: Edge Functions automatically validate tokens and provide user context

### Security

- ✅ Tokens are validated using Rownd's public keys (JWKS)
- ✅ User isolation is enforced at the database level
- ✅ Service role key is only used server-side
- ✅ All operations are scoped to the authenticated user

## 🤝 Migration Guide

### From Standard Supabase

1. **Install the SDK**:
   ```bash
   npm install @rownd/supabase-js
   ```

2. **Update imports**:
   ```typescript
   // Change this:
   import { createClient } from '@supabase/supabase-js'
   
   // To this:
   import { createClient } from '@rownd/supabase-js'
   ```

3. **Add token getter**:
   ```typescript
   const { getAccessToken } = useRownd()
   const supabase = createClient(url, key, { getAccessToken })
   ```

4. **Run setup** (when prompted):
   ```bash
   npx @rownd/supabase-js setup --url YOUR_URL --service-key YOUR_KEY
   ```

That's it! All your existing Supabase code continues to work.

## 📚 Advanced Usage

### Custom Headers

```typescript
// Frontend - Add custom headers to function calls
const { data } = await supabase.functions.invoke('my-function', {
  headers: { 'X-Custom-Header': 'value' }
})
```

### Error Handling

```typescript
// Frontend
const { data, error } = await supabase.from('todos').select('*')
if (error) {
  console.error('Failed to fetch todos:', error.message)
}

// Backend
serve(async (req, { userId, supabase }) => {
  try {
    const { data, error } = await supabase.from('todos').select('*')
    if (error) throw error
    
    return new Response(JSON.stringify({ data }))
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }), 
      { status: 500 }
    )
  }
})
```

## 🐛 Troubleshooting

### "Missing X-Rownd-Token header" error
- Ensure you're passing `getAccessToken` when creating the client
- Check that the user is authenticated with Rownd

### "Failed to auto-deploy proxy function"
- Run the setup command manually: `npx @rownd/supabase-js setup`
- Ensure you have the Supabase CLI installed and configured

### CORS errors
- The SDK handles CORS automatically
- If you still see errors, check your Supabase project's CORS settings

## 📄 License

MIT

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 🔗 Links

- [Rownd Documentation](https://docs.rownd.io)
- [Supabase Documentation](https://supabase.com/docs)
- [Example Project](https://github.com/rownd/supabase-example) 