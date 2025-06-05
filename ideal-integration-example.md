# Ideal Rownd + Supabase Integration

## Frontend - Minimal Changes (2 lines)

### Before (Standard Supabase)
```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(url, anonKey)

// Use normally
const { data } = await supabase.from('todos').select('*')
const { data } = await supabase.functions.invoke('my-function')
```

### After (With Rownd) - Just 2 changes!
```typescript
import { createClient } from '@rownd/supabase-js'  // ← Change 1: Different import
import { useRownd } from '@rownd/react'

const { getAccessToken } = useRownd()
const supabase = createClient(url, anonKey, { getAccessToken }) // ← Change 2: Pass token getter

// Use exactly the same! No other code changes
const { data } = await supabase.from('todos').select('*')
const { data } = await supabase.functions.invoke('my-function')
```

## Backend - Minimal Changes (1 line per function)

### Before (Standard Edge Function)
```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  // Your function logic
  const supabase = createClient(url, serviceKey)
  const { data } = await supabase.from('todos').select('*')
  return new Response(JSON.stringify({ data }))
})
```

### After (With Rownd) - Just 1 change!
```typescript
import { serve } from '@rownd/supabase-edge'  // ← Only change needed!
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req, { userId }) => {  // ← userId automatically provided
  // Your function logic - exactly the same!
  const supabase = createClient(url, serviceKey)
  const { data } = await supabase.from('todos').select('*').eq('user_id', userId)
  return new Response(JSON.stringify({ data }))
})
```

## What the SDK Would Handle Automatically

### Frontend SDK (`@rownd/supabase-js`)
- ✅ Automatic token injection for all operations
- ✅ Transparent proxy for database operations through Edge Functions
- ✅ Handle storage operations with proper auth
- ✅ Direct Edge Function calls with auth
- ✅ Full TypeScript support
- ✅ Drop-in replacement for `@supabase/supabase-js`

### Backend SDK (`@rownd/supabase-edge`)
- ✅ Automatic token validation
- ✅ Extract and provide userId
- ✅ Handle CORS
- ✅ Error handling
- ✅ Drop-in replacement for Deno serve

## Implementation Strategy

### Option 1: Full Transparency (Recommended)
The SDK automatically creates a universal proxy Edge Function on first use:

```typescript
// This happens automatically when you first use the SDK
await supabase.autoSetup() // Creates proxy function if needed
```

### Option 2: Explicit Setup
```bash
npx @rownd/supabase-js setup
# This command would:
# 1. Create the universal proxy function
# 2. Update your supabase/config.toml
# 3. Deploy the function
```

## Benefits of This Approach

1. **Minimal Code Changes**: 
   - Frontend: 2 lines
   - Backend: 1 line per function

2. **No Breaking Changes**: 
   - Existing Supabase code works as-is
   - Just change the import

3. **Automatic Everything**:
   - Token management
   - User isolation
   - CORS handling
   - Error handling

4. **Developer Experience**:
   - IntelliSense/TypeScript support
   - Same API as Supabase
   - Clear error messages

## Migration Path

For existing Supabase projects:

```bash
# Step 1: Install
npm install @rownd/supabase-js

# Step 2: Find and replace imports
# From: import { createClient } from '@supabase/supabase-js'
# To:   import { createClient } from '@rownd/supabase-js'

# Step 3: Add token getter
const supabase = createClient(url, key, { getAccessToken })

# Done! Everything else works the same
```

## Summary

With proper SDK design, adding Rownd to Supabase requires:
- **Frontend**: Change 1 import + add token getter (2 lines total)
- **Backend**: Change 1 import per Edge Function
- **Zero** changes to business logic
- **Zero** manual token handling
- **Zero** custom proxy functions to write

This is the level of simplicity developers expect from a good integration! 