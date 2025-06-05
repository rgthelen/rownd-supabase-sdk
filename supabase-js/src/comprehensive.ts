import { SupabaseClient, createClient } from '@supabase/supabase-js';

export interface RowndSupabaseOptions {
  supabaseUrl: string;
  supabaseAnonKey: string;
  getAccessToken: (options?: { waitForToken?: boolean }) => Promise<string | null | undefined>;
  useRowndAuth?: boolean; // Option to use Rownd auth for all operations
}

/**
 * Creates a Supabase client that uses Rownd authentication for all operations
 * This includes database queries, storage, realtime, etc.
 */
export function createRowndSupabaseClient(options: RowndSupabaseOptions): SupabaseClient {
  const { supabaseUrl, supabaseAnonKey, getAccessToken, useRowndAuth = false } = options;
  
  // Create the base Supabase client with custom auth
  const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
      // Custom storage that always returns null (no Supabase auth)
      storage: {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {}
      }
    },
    global: {
      headers: {},
      // Custom fetch that injects Rownd token
      fetch: async (url: RequestInfo | URL, init?: RequestInit) => {
        if (useRowndAuth) {
          const token = await getAccessToken({ waitForToken: true });
          
          if (token) {
            const headers = new Headers(init?.headers || {});
            
            // For Edge Functions, use X-Rownd-Token
            if (url.toString().includes('/functions/v1/')) {
              headers.set('X-Rownd-Token', token);
            } else {
              // For other Supabase services, we'd need custom RLS or Edge Functions
              // This is where it gets tricky - Supabase's PostgREST expects Supabase JWTs
              headers.set('X-Rownd-Token', token);
            }
            
            return fetch(url, {
              ...init,
              headers
            });
          }
        }
        
        return fetch(url, init);
      }
    }
  });

  // Create a proxy to intercept all operations
  const rowndClient = new Proxy(supabaseClient, {
    get(target, prop) {
      // Special handling for functions (already implemented)
      if (prop === 'functions') {
        return {
          invoke: async <T = any>(
            functionName: string,
            options?: {
              body?: any;
              headers?: Record<string, string>;
            }
          ): Promise<{ data: T | null; error: Error | null }> => {
            try {
              const token = await getAccessToken({ waitForToken: true });
              
              if (!token) {
                return {
                  data: null,
                  error: new Error('Failed to get authentication token from Rownd')
                };
              }
              
              const headers = {
                ...options?.headers,
                'X-Rownd-Token': token
              };
              
              return await target.functions.invoke<T>(functionName, {
                ...options,
                headers
              });
            } catch (error) {
              return {
                data: null,
                error: error instanceof Error ? error : new Error(String(error))
              };
            }
          }
        };
      }

      // For database operations (from, rpc)
      if (prop === 'from' || prop === 'rpc') {
        // Note: This is where we hit a limitation
        // Supabase's PostgREST expects Supabase JWTs for RLS
        // Solutions:
        // 1. Use Edge Functions as a proxy for all DB operations
        // 2. Disable RLS and use service role (not recommended)
        // 3. Create a custom PostgREST proxy that validates Rownd tokens
        
        console.warn(
          `Direct database access with Rownd tokens requires custom Edge Functions. ` +
          `Consider creating Edge Functions to proxy your database operations.`
        );
      }

      // Return the original property
      return target[prop as keyof SupabaseClient];
    }
  }) as SupabaseClient;
  
  return rowndClient;
}

/**
 * Alternative approach: Create a client that routes ALL operations through Edge Functions
 */
export function createRowndProxyClient(options: RowndSupabaseOptions) {
  const { supabaseUrl, supabaseAnonKey, getAccessToken } = options;
  
  return {
    // Database operations through Edge Functions
    from: (table: string) => ({
      select: (columns = '*') => ({
        execute: async () => {
          const token = await getAccessToken({ waitForToken: true });
          const response = await fetch(`${supabaseUrl}/functions/v1/db-proxy`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Rownd-Token': token || '',
              'apikey': supabaseAnonKey
            },
            body: JSON.stringify({
              operation: 'select',
              table,
              columns
            })
          });
          
          const data = await response.json();
          return { data: data.result, error: data.error };
        }
      }),
      
      insert: (values: any) => ({
        execute: async () => {
          const token = await getAccessToken({ waitForToken: true });
          const response = await fetch(`${supabaseUrl}/functions/v1/db-proxy`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Rownd-Token': token || '',
              'apikey': supabaseAnonKey
            },
            body: JSON.stringify({
              operation: 'insert',
              table,
              values
            })
          });
          
          const data = await response.json();
          return { data: data.result, error: data.error };
        }
      }),
      
      // Add update, delete, etc.
    }),
    
    // Storage operations through Edge Functions
    storage: {
      from: (bucket: string) => ({
        upload: async (path: string, file: File) => {
          const token = await getAccessToken({ waitForToken: true });
          const formData = new FormData();
          formData.append('file', file);
          formData.append('path', path);
          formData.append('bucket', bucket);
          
          const response = await fetch(`${supabaseUrl}/functions/v1/storage-proxy`, {
            method: 'POST',
            headers: {
              'X-Rownd-Token': token || '',
              'apikey': supabaseAnonKey
            },
            body: formData
          });
          
          const data = await response.json();
          return { data: data.result, error: data.error };
        }
      })
    },
    
    // Edge Functions (already working)
    functions: {
      invoke: async (functionName: string, options?: any) => {
        const token = await getAccessToken({ waitForToken: true });
        const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Rownd-Token': token || '',
            'apikey': supabaseAnonKey,
            ...options?.headers
          },
          body: options?.body ? JSON.stringify(options.body) : undefined
        });
        
        const data = await response.json();
        return { data, error: null };
      }
    }
  };
} 