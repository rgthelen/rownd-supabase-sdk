// Example 1: Get Todos Function
// File: supabase/functions/get-todos/index.ts

// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createRowndHandler } from 'https://esm.sh/@rownd/supabase-edge@1.0.0/simplified'

createRowndHandler(async (req, { userId, supabase }) => {
  const { data: todos, error } = await supabase
    .from('todos')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error

  return { todos }
})

// Example 2: Add Todo Function
// File: supabase/functions/add-todo/index.ts

// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createRowndHandler } from 'https://esm.sh/@rownd/supabase-edge@1.0.0/simplified'

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

// Example 3: Update Todo Function
// File: supabase/functions/update-todo/index.ts

// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createRowndHandler } from 'https://esm.sh/@rownd/supabase-edge@1.0.0/simplified'

createRowndHandler(async (req, { userId, supabase }) => {
  const { id, is_complete } = await req.json()

  const { error } = await supabase
    .from('todos')
    .update({ is_complete })
    .eq('id', id)
    .eq('user_id', userId)

  if (error) throw error

  return { success: true }
})

// Example 4: Delete Todo Function
// File: supabase/functions/delete-todo/index.ts

// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createRowndHandler } from 'https://esm.sh/@rownd/supabase-edge@1.0.0/simplified'

createRowndHandler(async (req, { userId, supabase }) => {
  const { id } = await req.json()

  const { error } = await supabase
    .from('todos')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) throw error

  return { success: true }
})

// Example 5: Advanced Usage with Token Claims
// File: supabase/functions/user-profile/index.ts

// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createRowndHandler } from 'https://esm.sh/@rownd/supabase-edge@1.0.0/simplified'

createRowndHandler(async (req, { userId, supabase, token }) => {
  // Access additional token claims
  const email = token.email
  const isVerified = token['https://auth.rownd.io/is_verified_user']
  
  // Get or create user profile
  const { data: profile, error } = await supabase
    .from('profiles')
    .upsert({
      user_id: userId,
      email,
      is_verified: isVerified,
      updated_at: new Date().toISOString()
    })
    .select()
    .single()

  if (error) throw error

  return { profile }
}, {
  corsOrigin: 'https://yourdomain.com'
}) 