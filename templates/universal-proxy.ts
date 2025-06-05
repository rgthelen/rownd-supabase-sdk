// @ts-nocheck
/**
 * Universal Proxy Function for Rownd + Supabase Integration
 * 
 * This Edge Function validates Rownd tokens and proxies database/storage operations
 * to Supabase with proper user isolation.
 * 
 * Deploy as: supabase/functions/_rownd_universal_proxy/index.ts
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as jose from 'https://deno.land/x/jose@v4.14.4/index.ts'

const ROWND_JWKS_URL = 'https://api.rownd.io/hub/auth/keys'
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-rownd-token',
}

// Cache for Rownd's public keys
let jwksCache: jose.JSONWebKeySet | null = null
let jwksCacheTime = 0
const JWKS_CACHE_DURATION = 3600000 // 1 hour

async function getRowndKeys(): Promise<jose.JSONWebKeySet> {
  const now = Date.now()
  if (jwksCache && now - jwksCacheTime < JWKS_CACHE_DURATION) {
    return jwksCache
  }

  const response = await fetch(ROWND_JWKS_URL)
  if (!response.ok) {
    throw new Error(`Failed to fetch Rownd JWKS: ${response.statusText}`)
  }

  jwksCache = await response.json()
  jwksCacheTime = now
  return jwksCache!
}

async function validateRowndToken(token: string): Promise<{ userId: string; payload: any }> {
  try {
    const jwks = await getRowndKeys()
    const JWKS = jose.createRemoteJWKSet(new URL(ROWND_JWKS_URL))
    
    const { payload } = await jose.jwtVerify(token, JWKS, {
      issuer: 'https://api.rownd.io',
      audience: 'https://api.rownd.io',
    })

    if (!payload.sub) {
      throw new Error('Token missing subject claim')
    }

    return {
      userId: payload.sub,
      payload
    }
  } catch (error) {
    throw new Error(`Invalid token: ${error.message}`)
  }
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Get token from header
    const token = req.headers.get('x-rownd-token')
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Missing X-Rownd-Token header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate token
    const { userId } = await validateRowndToken(token)

    // Parse request body
    const body = await req.json()
    const { resource, operation } = body

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Handle health check
    if (resource === 'health') {
      return new Response(
        JSON.stringify({ status: 'ok', userId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Handle database operations
    if (resource === 'database') {
      const { table, query } = body
      let result

      switch (operation) {
        case 'select':
          result = await supabase
            .from(table)
            .select(query.select || '*')
            .eq('user_id', userId)
          break

        case 'insert':
          result = await supabase
            .from(table)
            .insert({ ...body.data, user_id: userId })
          break

        case 'update':
          result = await supabase
            .from(table)
            .update(body.data)
            .eq('user_id', userId)
            .eq('id', body.id)
          break

        case 'delete':
          result = await supabase
            .from(table)
            .delete()
            .eq('user_id', userId)
            .eq('id', body.id)
          break

        case 'upsert':
          result = await supabase
            .from(table)
            .upsert({ ...body.data, user_id: userId })
          break

        default:
          throw new Error(`Unknown database operation: ${operation}`)
      }

      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Handle storage operations
    if (resource === 'storage') {
      const { bucket, path } = body
      let result

      switch (operation) {
        case 'upload':
          const { file, options } = body
          const buffer = Uint8Array.from(atob(file.data), c => c.charCodeAt(0))
          result = await supabase.storage
            .from(bucket)
            .upload(`${userId}/${path}`, buffer, {
              ...options,
              contentType: file.type
            })
          break

        case 'download':
          const { data, error } = await supabase.storage
            .from(bucket)
            .download(`${userId}/${path}`)
          
          if (error) {
            result = { data: null, error }
          } else {
            const arrayBuffer = await data.arrayBuffer()
            const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))
            result = { data: { base64, type: data.type }, error: null }
          }
          break

        case 'remove':
          result = await supabase.storage
            .from(bucket)
            .remove(body.paths.map((p: string) => `${userId}/${p}`))
          break

        case 'list':
          result = await supabase.storage
            .from(bucket)
            .list(`${userId}/${path || ''}`, body.options)
          break

        default:
          throw new Error(`Unknown storage operation: ${operation}`)
      }

      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Handle RPC
    if (resource === 'rpc') {
      const { functionName, args } = body
      const result = await supabase.rpc(functionName, { ...args, user_id: userId })
      
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    throw new Error(`Unknown resource: ${resource}`)

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: error.message.includes('Invalid token') ? 401 : 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
}) 