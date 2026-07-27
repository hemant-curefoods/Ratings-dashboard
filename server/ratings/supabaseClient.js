import { insertRows } from '../../supabaseClient.js';
import { pool } from './db.js';

// Mock client for backward compatibility with older test scripts
export const supabase = {
  from: () => ({
    select: () => ({
      limit: () => Promise.resolve({ data: [], error: null })
    })
  })
};

export { insertRows };