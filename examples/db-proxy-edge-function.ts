// Example: Database Proxy Edge Function
// File: supabase/functions/db-proxy/index.ts

// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createRowndHandler } from 'https://esm.sh/@rownd/supabase-edge@1.0.0/simplified'

createRowndHandler(async (req, { userId, supabase }) => {
  const { operation, table, columns, values, filters, id } = await req.json()

  let query = supabase.from(table)

  switch (operation) {
    case 'select':
      query = query.select(columns || '*')
      
      // Always filter by user_id for security
      if (table !== 'public_tables') { // except for public tables
        query = query.eq('user_id', userId)
      }
      
      // Apply additional filters
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          query = query.eq(key, value)
        })
      }
      
      const { data: selectData, error: selectError } = await query
      if (selectError) throw selectError
      
      return { result: selectData }

    case 'insert':
      // Ensure user_id is set to the authenticated user
      const insertValues = Array.isArray(values) 
        ? values.map(v => ({ ...v, user_id: userId }))
        : { ...values, user_id: userId }
      
      const { data: insertData, error: insertError } = await query
        .insert(insertValues)
        .select()
      
      if (insertError) throw insertError
      
      return { result: insertData }

    case 'update':
      // Ensure updates are scoped to user's data
      const { data: updateData, error: updateError } = await query
        .update(values)
        .eq('id', id)
        .eq('user_id', userId) // Security: only update user's own data
        .select()
      
      if (updateError) throw updateError
      
      return { result: updateData }

    case 'delete':
      // Ensure deletes are scoped to user's data
      const { error: deleteError } = await query
        .delete()
        .eq('id', id)
        .eq('user_id', userId) // Security: only delete user's own data
      
      if (deleteError) throw deleteError
      
      return { result: { success: true } }

    default:
      throw new Error(`Unsupported operation: ${operation}`)
  }
})

// Example: Storage Proxy Edge Function
// File: supabase/functions/storage-proxy/index.ts

// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createRowndHandler } from 'https://esm.sh/@rownd/supabase-edge@1.0.0/simplified'

createRowndHandler(async (req, { userId, supabase }) => {
  const formData = await req.formData()
  const file = formData.get('file') as File
  const path = formData.get('path') as string
  const bucket = formData.get('bucket') as string
  const operation = formData.get('operation') as string || 'upload'

  // Ensure user can only access their own files
  const userPath = `${userId}/${path}`

  switch (operation) {
    case 'upload':
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(userPath, file, {
          upsert: true
        })
      
      if (uploadError) throw uploadError
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(userPath)
      
      return { result: { path: uploadData.path, publicUrl } }

    case 'delete':
      const { error: deleteError } = await supabase.storage
        .from(bucket)
        .remove([userPath])
      
      if (deleteError) throw deleteError
      
      return { result: { success: true } }

    case 'list':
      const { data: listData, error: listError } = await supabase.storage
        .from(bucket)
        .list(userId, {
          limit: 100,
          offset: 0
        })
      
      if (listError) throw listError
      
      return { result: listData }

    default:
      throw new Error(`Unsupported operation: ${operation}`)
  }
}) 