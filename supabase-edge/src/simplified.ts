// @ts-nocheck
// Simplified version for direct use in Edge Functions

import * as jose from 'https://deno.land/x/jose@v4.14.4/index.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ROWND_JWKS_URL = 'https://api.rownd.io/hub/auth/keys'
const ROWND_ISSUER = 'https://api.rownd.io'

let jwksCache: jose.JWTVerifyGetKey | null = null
let cacheExpiry = 0

async function getJWKS(): Promise<jose.JWTVerifyGetKey> {
  const now = Date.now()
  if (jwksCache && now < cacheExpiry) {
    return jwksCache
  }

  const response = await fetch(ROWND_JWKS_URL)
  const jwks = await response.json()
  
  jwksCache = jose.createLocalJWKSet(jwks)
  cacheExpiry = now + (30 * 60 * 1000) // Cache for 30 minutes
  
  return jwksCache
}

export async function validateRowndToken(req: Request) {
  const rowndToken = req.headers.get('X-Rownd-Token')
  
  if (!rowndToken) {
    throw new Error('Missing X-Rownd-Token header')
  }

  try {
    const jwks = await getJWKS()
    const { payload } = await jose.jwtVerify(rowndToken, jwks, {
      issuer: ROWND_ISSUER,
    })
    
    if (!payload.sub) {
      throw new Error('Invalid token: missing sub (user_id)')
    }
    
    return {
      ...payload,
      user_id: payload.sub as string
    }
  } catch (error) {
    throw new Error(`Token validation failed: ${error.message}`)
  }
}

export interface RowndHandlerContext {
  userId: string
  token: any
  supabase: any
  request: Request
}

export type RowndHandler = (
  req: Request,
  context: RowndHandlerContext
) => Promise<any> | any

export function createRowndHandler(
  handler: RowndHandler,
  options: {
    corsOrigin?: string
    additionalHeaders?: string[]
  } = {}
) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': options.corsOrigin || '*',
    'Access-Control-Allow-Headers': [
      'authorization',
      'x-client-info', 
      'apikey',
      'content-type',
      'x-rownd-token',
      ...(options.additionalHeaders || [])
    ].join(', ')
  }

  return Deno.serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders })
    }

    try {
      // Validate Rownd token
      const tokenPayload = await validateRowndToken(req)
      
      // Initialize Supabase client
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )

      // Create context
      const context: RowndHandlerContext = {
        userId: tokenPayload.user_id,
        token: tokenPayload,
        supabase,
        request: req
      }

      // Call the handler
      const result = await handler(req, context)

      // Handle response
      if (result instanceof Response) {
        return result
      }

      return new Response(
        JSON.stringify(result),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    } catch (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      )
    }
  })
} 