#!/usr/bin/env node

import { Command } from 'commander';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { PROXY_FUNCTION_CODE } from './proxy.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const program = new Command();

program
  .name('@rownd/supabase-js')
  .description('CLI tool for setting up Rownd + Supabase integration')
  .version('1.0.0');

program
  .command('setup')
  .description('Deploy the universal proxy function to your Supabase project')
  .requiredOption('--url <url>', 'Your Supabase project URL')
  .requiredOption('--service-key <key>', 'Your Supabase service role key')
  .option('--project-ref <ref>', 'Your Supabase project reference (extracted from URL if not provided)')
  .action(async (options) => {
    try {
      console.log('🚀 Setting up Rownd + Supabase integration...\n');

      // Extract project ref from URL if not provided
      const projectRef = options.projectRef || options.url.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
      if (!projectRef) {
        console.error('❌ Could not extract project reference from URL. Please provide --project-ref');
        process.exit(1);
      }

      // Create Supabase client
      const supabase = createClient(options.url, options.serviceKey);

      // Deploy using Supabase CLI (if available) or Management API
      console.log('📦 Creating Edge Function: _rownd_universal_proxy');
      
      // Check if function already exists
      try {
        const { data, error } = await supabase.functions.invoke('_rownd_universal_proxy', {
          body: { resource: 'health' }
        });
        
        if (!error && data?.status === 'ok') {
          console.log('✅ Proxy function already deployed and working!');
          return;
        }
      } catch (e) {
        // Function doesn't exist, proceed with deployment
      }

      // Create the function directory
      const functionsDir = path.join(process.cwd(), 'supabase', 'functions', '_rownd_universal_proxy');
      await fs.mkdir(functionsDir, { recursive: true });

      // Write the function code using the exported constant
      await fs.writeFile(path.join(functionsDir, 'index.ts'), PROXY_FUNCTION_CODE);

      console.log(`
✅ Function code created at: ${functionsDir}

To deploy the function, run:

  supabase functions deploy _rownd_universal_proxy

Or if you haven't linked your project yet:

  supabase link --project-ref ${projectRef}
  supabase functions deploy _rownd_universal_proxy

After deployment, your Rownd + Supabase integration will be ready to use!
      `);

    } catch (error) {
      console.error('❌ Setup failed:', error);
      process.exit(1);
    }
  });

program.parse(); 