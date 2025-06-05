# @rownd/supabase-js

Seamless integration between Rownd authentication and Supabase Edge Functions.

## Installation

### For Testing (Direct from GitHub)

```bash
# Clone the repository
git clone https://github.com/rgthelen/rownd-supabase-sdk.git

# Or use as a git submodule
git submodule add https://github.com/rgthelen/rownd-supabase-sdk.git

# Or import directly in your code (see usage below)
```

### For Production (NPM)

```bash
npm install @rownd/supabase-js @supabase/supabase-js
```

## Usage

### Direct GitHub Import (ES Modules)

```typescript
// Import directly from GitHub (for modern bundlers that support URL imports)
import { createRowndSupabaseClient } from 'https://raw.githubusercontent.com/rgthelen/rownd-supabase-sdk/main/supabase-js/index.ts';
import { useRownd } from '@rownd/react';

// Or if you've cloned/submoduled the repo
import { createRowndSupabaseClient } from './rownd-supabase-sdk/supabase-js/index.ts';
```

### Standard Usage

```typescript
import { createRowndSupabaseClient } from '@rownd/supabase-js';
import { useRownd } from '@rownd/react';

function MyComponent() {
  const { getAccessToken } = useRownd();
  
  const supabase = createRowndSupabaseClient({
    supabaseUrl: 'YOUR_SUPABASE_URL',
    supabaseAnonKey: 'YOUR_SUPABASE_ANON_KEY',
    getAccessToken
  });

  const fetchTodos = async () => {
    // Token is automatically injected as X-Rownd-Token header
    const { data, error } = await supabase.functions.invoke('get-todos');
    
    if (error) {
      console.error('Error:', error);
      return;
    }
    
    console.log('Todos:', data.todos);
  };

  const addTodo = async (task: string) => {
    const { data, error } = await supabase.functions.invoke('add-todo', {
      body: { task }
    });
    
    if (error) {
      console.error('Error:', error);
      return;
    }
    
    console.log('New todo:', data.todo);
  };
}
```

## Features

- Automatic Rownd token injection
- Seamless integration with existing Supabase client
- TypeScript support
- Error handling
- Works with all Supabase Edge Functions

## How it works

This SDK wraps the standard Supabase client and automatically:
1. Retrieves the Rownd access token when calling Edge Functions
2. Injects it as the `X-Rownd-Token` header
3. Handles token retrieval errors gracefully

The `X-Rownd-Token` header is used instead of `Authorization` to avoid conflicts with Supabase's built-in authentication. 