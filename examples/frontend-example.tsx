import React, { useState, useEffect } from 'react';
import { useRownd } from '@rownd/react';
import { createRowndSupabaseClient } from '@rownd/supabase-js';

// Initialize the Rownd-enabled Supabase client
function useRowndSupabase() {
  const { getAccessToken } = useRownd();
  
  return createRowndSupabaseClient({
    supabaseUrl: process.env.REACT_APP_SUPABASE_URL!,
    supabaseAnonKey: process.env.REACT_APP_SUPABASE_ANON_KEY!,
    getAccessToken
  });
}

interface Todo {
  id: number;
  user_id: string;
  task: string;
  is_complete: boolean;
  created_at: string;
}

export function TodoApp() {
  const { is_authenticated, user } = useRownd();
  const supabase = useRowndSupabase();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTask, setNewTask] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (is_authenticated) {
      fetchTodos();
    }
  }, [is_authenticated]);

  const fetchTodos = async () => {
    setLoading(true);
    // Token is automatically injected!
    const { data, error } = await supabase.functions.invoke<{ todos: Todo[] }>('get-todos');
    
    if (!error && data) {
      setTodos(data.todos);
    }
    setLoading(false);
  };

  const addTodo = async () => {
    if (!newTask.trim()) return;
    
    const { data, error } = await supabase.functions.invoke<{ todo: Todo }>('add-todo', {
      body: { task: newTask }
    });
    
    if (!error && data) {
      setTodos([...todos, data.todo]);
      setNewTask('');
    }
  };

  const toggleTodo = async (id: number, is_complete: boolean) => {
    const { error } = await supabase.functions.invoke('update-todo', {
      body: { id, is_complete: !is_complete }
    });
    
    if (!error) {
      setTodos(todos.map(todo => 
        todo.id === id ? { ...todo, is_complete: !is_complete } : todo
      ));
    }
  };

  const deleteTodo = async (id: number) => {
    const { error } = await supabase.functions.invoke('delete-todo', {
      body: { id }
    });
    
    if (!error) {
      setTodos(todos.filter(todo => todo.id !== id));
    }
  };

  if (!is_authenticated) {
    return <div>Please sign in to continue</div>;
  }

  return (
    <div>
      <h1>My Todos</h1>
      
      <div>
        <input
          type="text"
          value={newTask}
          onChange={(e) => setNewTask(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && addTodo()}
          placeholder="Add a new task..."
        />
        <button onClick={addTodo}>Add</button>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <ul>
          {todos.map((todo) => (
            <li key={todo.id}>
              <input
                type="checkbox"
                checked={todo.is_complete}
                onChange={() => toggleTodo(todo.id, todo.is_complete)}
              />
              <span style={{ textDecoration: todo.is_complete ? 'line-through' : 'none' }}>
                {todo.task}
              </span>
              <button onClick={() => deleteTodo(todo.id)}>Delete</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
} 