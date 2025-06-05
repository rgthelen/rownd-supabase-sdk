import React, { useState, useEffect } from 'react';
import { useRownd } from '@rownd/react';
import { createRowndProxyClient } from '@rownd/supabase-js/comprehensive';

// Initialize the Rownd proxy client that routes everything through Edge Functions
function useRowndSupabaseProxy() {
  const { getAccessToken } = useRownd();
  
  return createRowndProxyClient({
    supabaseUrl: process.env.REACT_APP_SUPABASE_URL!,
    supabaseAnonKey: process.env.REACT_APP_SUPABASE_ANON_KEY!,
    getAccessToken
  });
}

export function ComprehensiveApp() {
  const { is_authenticated } = useRownd();
  const supabase = useRowndSupabaseProxy();
  const [todos, setTodos] = useState<any[]>([]);
  const [profilePic, setProfilePic] = useState<string>('');

  // Example: Database operations through proxy
  const fetchTodos = async () => {
    // This goes through the db-proxy Edge Function
    const { data, error } = await supabase
      .from('todos')
      .select('*')
      .execute();
    
    if (!error && data) {
      setTodos(data);
    }
  };

  const addTodo = async (task: string) => {
    // This also goes through the db-proxy Edge Function
    const { data, error } = await supabase
      .from('todos')
      .insert({ task, is_complete: false })
      .execute();
    
    if (!error && data) {
      await fetchTodos();
    }
  };

  // Example: Storage operations through proxy
  const uploadProfilePic = async (file: File) => {
    // This goes through the storage-proxy Edge Function
    const { data, error } = await supabase.storage
      .from('avatars')
      .upload('profile.jpg', file);
    
    if (!error && data) {
      setProfilePic(data.publicUrl);
    }
  };

  // Example: Direct Edge Function call (already working)
  const customOperation = async () => {
    const { data, error } = await supabase.functions.invoke('custom-function', {
      body: { action: 'process' }
    });
    
    console.log('Custom function result:', data);
  };

  return (
    <div>
      <h1>Comprehensive Rownd + Supabase Integration</h1>
      
      {/* Database operations */}
      <section>
        <h2>Database Operations (via db-proxy)</h2>
        <button onClick={fetchTodos}>Fetch Todos</button>
        <button onClick={() => addTodo('New task')}>Add Todo</button>
        <ul>
          {todos.map(todo => (
            <li key={todo.id}>{todo.task}</li>
          ))}
        </ul>
      </section>

      {/* Storage operations */}
      <section>
        <h2>Storage Operations (via storage-proxy)</h2>
        <input 
          type="file" 
          onChange={(e) => e.target.files?.[0] && uploadProfilePic(e.target.files[0])}
        />
        {profilePic && <img src={profilePic} alt="Profile" />}
      </section>

      {/* Edge Functions */}
      <section>
        <h2>Edge Functions (direct)</h2>
        <button onClick={customOperation}>Call Custom Function</button>
      </section>
    </div>
  );
}

// Alternative: Using the standard Supabase client with warnings
export function StandardClientExample() {
  const { getAccessToken } = useRownd();
  
  // This creates a client that warns about direct DB access
  const supabase = createRowndSupabaseClient({
    supabaseUrl: process.env.REACT_APP_SUPABASE_URL!,
    supabaseAnonKey: process.env.REACT_APP_SUPABASE_ANON_KEY!,
    getAccessToken,
    useRowndAuth: true // Enables warnings for non-Edge Function operations
  });

  const tryDirectDatabaseAccess = async () => {
    // This will log a warning because PostgREST expects Supabase JWTs
    const { data, error } = await supabase
      .from('todos')
      .select('*');
    
    // Will likely fail with auth error unless RLS is disabled
    console.log('Direct DB access result:', { data, error });
  };

  const useEdgeFunctions = async () => {
    // This works perfectly - Edge Functions support Rownd tokens
    const { data, error } = await supabase.functions.invoke('get-todos');
    console.log('Edge Function result:', { data, error });
  };

  return (
    <div>
      <h1>Standard Client with Rownd Auth</h1>
      <button onClick={tryDirectDatabaseAccess}>
        Try Direct DB Access (will warn/fail)
      </button>
      <button onClick={useEdgeFunctions}>
        Use Edge Functions (works!)
      </button>
    </div>
  );
} 