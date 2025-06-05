// @ts-nocheck
/**
 * @rownd/supabase-edge
 * 
 * Drop-in replacement for Deno.serve that automatically validates Rownd tokens
 * and provides userId in the handler context.
 * 
 * @example
 * ```typescript
 * import { serve } from '@rownd/supabase-edge'  // Only change needed!
 * 
 * serve(async (req, { userId, supabase }) => {
 *   // Your existing code works as-is
 *   const { data } = await supabase
 *     .from('todos')
 *     .select('*')
 *     .eq('user_id', userId)
 *   
 *   return new Response(JSON.stringify({ data }))
 * })
 * ```
 */

import * as jose from 'https://deno.land/x/jose@v4.14.4/index.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// JWKS cache
let jwksCache: jose.KeyLike | null = null
let jwksCacheTime = 0
const JWKS_CACHE_DURATION = 3600000 // 1 hour

const ROWND_JWKS_URL = 'https://api.rownd.io/hub/auth/keys'
const ROWND_ISSUER = 'https://api.rownd.io'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-rownd-token',
}

async function getRowndJWKS() {
  const now = Date.now()
  if (jwksCache && now - jwksCacheTime < JWKS_CACHE_DURATION) {
    return jwksCache
  }

  const JWKS = jose.createRemoteJWKSet(new URL(ROWND_JWKS_URL))
  jwksCache = JWKS
  jwksCacheTime = now
  return JWKS
}

async function validateRowndToken(token: string): Promise<{ userId: string; payload: any }> {
  try {
    const JWKS = await getRowndJWKS()
    
    const { payload } = await jose.jwtVerify(token, JWKS, {
      issuer: ROWND_ISSUER,
      audience: ROWND_ISSUER,
    })

    if (!payload.sub) {
      throw new Error('Token missing subject claim')
    }

    return {
      userId: payload.sub,
      payload
    }
  } catch (error: any) {
    throw new Error(`Invalid token: ${error.message}`)
  }
}

export interface RowndContext {
  userId: string
  supabase: any // SupabaseClient from edge runtime
  token: any // Full token payload
}

export type RowndHandler = (
  req: Request,
  context: RowndContext
) => Response | Promise<Response>

/**
 * Drop-in replacement for Deno.serve with automatic Rownd token validation.
 * 
 * @param handler Your existing handler function, now with userId provided
 * @returns void (starts the server)
 */
export function serve(handler: RowndHandler): void {
  // @ts-ignore - Deno global
  Deno.serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders })
    }

    try {
      // Get token from header
      const token = req.headers.get('x-rownd-token')
      if (!token) {
        return new Response(
          JSON.stringify({ error: 'Missing X-Rownd-Token header' }),
          { 
            status: 401, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      // Validate token and get userId
      const { userId, payload } = await validateRowndToken(token)

      // Create Supabase client
      // @ts-ignore - Deno.env
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      // @ts-ignore - Deno.env
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      const supabase = createClient(supabaseUrl, supabaseServiceKey)

      // Create context with userId and supabase client
      const context: RowndContext = {
        userId,
        supabase,
        token: payload
      }

      // Call the user's handler with the context
      const response = await handler(req, context)

      // Ensure CORS headers are added to the response
      if (!response.headers.has('Access-Control-Allow-Origin')) {
        Object.entries(corsHeaders).forEach(([key, value]) => {
          response.headers.set(key, value)
        })
      }

      return response

    } catch (error: any) {
      console.error('Error in Rownd Edge Function:', error)
      
      const status = error.message.includes('Invalid token') ? 401 : 500
      
      return new Response(
        JSON.stringify({ error: error.message }),
        { 
          status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }
  })
}

// Re-export serve as default for convenience
export default serve 