import { SupabaseClient, createClient as createSupabaseClient } from '@supabase/supabase-js';

export interface RowndSupabaseOptions {
  getAccessToken: (options?: { waitForToken?: boolean }) => Promise<string | null | undefined>;
  autoSetup?: boolean; // Automatically deploy proxy function if needed (default: true)
}

// Re-export everything from Supabase so it's a true drop-in replacement
export * from '@supabase/supabase-js';

// Global state for proxy deployment
let proxyDeploymentPromise: Promise<void> | null = null;
let proxyDeployed = false;

/**
 * Creates a Supabase client with Rownd authentication.
 * Drop-in replacement for @supabase/supabase-js createClient.
 * 
 * @example
 * ```typescript
 * import { createClient } from '@rownd/supabase-js'
 * import { useRownd } from '@rownd/react'
 * 
 * const { getAccessToken } = useRownd()
 * const supabase = createClient(url, key, { getAccessToken })
 * 
 * // Use exactly like standard Supabase client
 * const { data } = await supabase.from('todos').select('*')
 * ```
 */
export function createClient(
  supabaseUrl: string,
  supabaseAnonKey: string,
  options: RowndSupabaseOptions
): SupabaseClient {
  const { getAccessToken, autoSetup = true } = options;
  
  // Create the base Supabase client
  const baseClient = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    }
  });

  // Auto-deploy proxy function if needed
  if (autoSetup && !proxyDeployed && typeof window !== 'undefined') {
    proxyDeploymentPromise = deployProxyFunction(baseClient, supabaseUrl, supabaseAnonKey)
      .then(() => { proxyDeployed = true; })
      .catch(err => {
        console.warn('Failed to auto-deploy Rownd proxy function:', err);
        console.warn('You may need to run: npx @rownd/supabase-js setup');
      });
  }

  // Create a proxy that intercepts all operations
  return new Proxy(baseClient, {
    get(target, prop) {
      // Handle database operations
      if (prop === 'from') {
        return (table: string) => {
          const originalQueryBuilder = target.from(table);
          
          // Intercept the final execute methods
          return new Proxy(originalQueryBuilder, {
            get(qbTarget, qbProp) {
              // For methods that execute queries, route through proxy
              if (['select', 'insert', 'update', 'delete', 'upsert'].includes(String(qbProp))) {
                return (...args: any[]) => {
                  const query = qbTarget[qbProp](...args);
                  
                  // Override the execution
                  const originalThen = query.then.bind(query);
                  query.then = async (onfulfilled?: any, onrejected?: any) => {
                    // Wait for proxy deployment if in progress
                    if (proxyDeploymentPromise) {
                      await proxyDeploymentPromise;
                    }

                    // Get token and execute through proxy
                    const token = await getAccessToken({ waitForToken: true });
                    if (!token) {
                      const error = new Error('Failed to get authentication token from Rownd');
                      return onrejected ? onrejected(error) : Promise.reject(error);
                    }

                    // Route through universal proxy
                    const proxyResult = await target.functions.invoke('_rownd_universal_proxy', {
                      body: {
                        resource: 'database',
                        operation: String(qbProp),
                        table,
                        query: serializeQuery(query)
                      },
                      headers: { 'X-Rownd-Token': token }
                    });

                    if (proxyResult.error) {
                      return onrejected ? onrejected(proxyResult.error) : Promise.reject(proxyResult.error);
                    }

                    return onfulfilled ? onfulfilled(proxyResult.data) : proxyResult.data;
                  };

                  return query;
                };
              }
              
              return qbTarget[qbProp as keyof typeof qbTarget];
            }
          });
        };
      }

      // Handle Edge Functions
      if (prop === 'functions') {
        return {
          invoke: async (functionName: string, options?: any) => {
            const token = await getAccessToken({ waitForToken: true });
            if (!token) {
              return {
                data: null,
                error: new Error('Failed to get authentication token from Rownd')
              };
            }

            return target.functions.invoke(functionName, {
              ...options,
              headers: {
                ...options?.headers,
                'X-Rownd-Token': token
              }
            });
          }
        };
      }

      // Handle storage operations
      if (prop === 'storage') {
        return {
          from: (bucket: string) => ({
            upload: async (path: string, file: File, options?: any) => {
              if (proxyDeploymentPromise) await proxyDeploymentPromise;
              
              const token = await getAccessToken({ waitForToken: true });
              if (!token) {
                return { data: null, error: new Error('No authentication token') };
              }

              // Convert file to base64 for proxy transport
              const base64 = await fileToBase64(file);
              
              return target.functions.invoke('_rownd_universal_proxy', {
                body: {
                  resource: 'storage',
                  operation: 'upload',
                  bucket,
                  path,
                  file: { data: base64, type: file.type },
                  options
                },
                headers: { 'X-Rownd-Token': token }
              });
            },

            download: async (path: string) => {
              if (proxyDeploymentPromise) await proxyDeploymentPromise;
              
              const token = await getAccessToken({ waitForToken: true });
              if (!token) {
                return { data: null, error: new Error('No authentication token') };
              }

              const result = await target.functions.invoke('_rownd_universal_proxy', {
                body: {
                  resource: 'storage',
                  operation: 'download',
                  bucket,
                  path
                },
                headers: { 'X-Rownd-Token': token }
              });

              if (result.error) return result;

              // Convert base64 back to blob
              const blob = base64ToBlob(result.data.base64, result.data.type);
              return { data: blob, error: null };
            },

            remove: async (paths: string[]) => {
              if (proxyDeploymentPromise) await proxyDeploymentPromise;
              
              const token = await getAccessToken({ waitForToken: true });
              if (!token) {
                return { data: null, error: new Error('No authentication token') };
              }

              return target.functions.invoke('_rownd_universal_proxy', {
                body: {
                  resource: 'storage',
                  operation: 'remove',
                  bucket,
                  paths
                },
                headers: { 'X-Rownd-Token': token }
              });
            },

            list: async (path?: string, options?: any) => {
              if (proxyDeploymentPromise) await proxyDeploymentPromise;
              
              const token = await getAccessToken({ waitForToken: true });
              if (!token) {
                return { data: null, error: new Error('No authentication token') };
              }

              return target.functions.invoke('_rownd_universal_proxy', {
                body: {
                  resource: 'storage',
                  operation: 'list',
                  bucket,
                  path,
                  options
                },
                headers: { 'X-Rownd-Token': token }
              });
            },

            getPublicUrl: (path: string) => {
              // This doesn't need auth
              return target.storage.from(bucket).getPublicUrl(path);
            }
          })
        };
      }

      // Handle RPC
      if (prop === 'rpc') {
        return async (fn: string, args?: any, options?: any) => {
          if (proxyDeploymentPromise) await proxyDeploymentPromise;
          
          const token = await getAccessToken({ waitForToken: true });
          if (!token) {
            throw new Error('Failed to get authentication token from Rownd');
          }

          return target.functions.invoke('_rownd_universal_proxy', {
            body: {
              resource: 'rpc',
              operation: 'call',
              functionName: fn,
              args,
              options
            },
            headers: { 'X-Rownd-Token': token }
          });
        };
      }

      // Return original for everything else
      return target[prop as keyof SupabaseClient];
    }
  }) as SupabaseClient;
}

// Helper to serialize query builder state
function serializeQuery(query: any): any {
  // This would extract filters, ordering, limits, etc. from the query builder
  // For now, simplified
  return {
    filters: query._filters || {},
    select: query._select || '*',
    order: query._order || [],
    limit: query._limit
  };
}

// Helper to convert file to base64
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]); // Remove data URL prefix
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Helper to convert base64 to blob
function base64ToBlob(base64: string, type: string): Blob {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type });
}

// Auto-deploy the universal proxy function
async function deployProxyFunction(
  client: SupabaseClient,
  supabaseUrl: string,
  supabaseAnonKey: string
): Promise<void> {
  // Check if proxy already exists
  try {
    const { data, error } = await client.functions.invoke('_rownd_universal_proxy', {
      body: { resource: 'health' }
    });
    
    if (!error && data?.status === 'ok') {
      return; // Already deployed
    }
  } catch (e) {
    // Function doesn't exist, need to deploy
  }

  // In a real implementation, this would:
  // 1. Use the Supabase Management API to create the function
  // 2. Upload the function code
  // 3. Deploy it
  
  // For now, we'll just log instructions
  console.log(`
    🚀 Rownd + Supabase Setup Required
    
    Run the following command to complete setup:
    
    npx @rownd/supabase-js setup --url ${supabaseUrl}
    
    This will create the necessary proxy function for database and storage operations.
  `);
}

// Re-export proxy function utilities for AI platforms
export { PROXY_FUNCTION_CODE, getProxyFunctionCode, writeProxyFunction } from './proxy'

// Export AI platform utilities
export { default as aiPlatform } from './ai-platforms' 