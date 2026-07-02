import { SUPABASE_ANON_KEY, SUPABASE_API_KEY, SUPABASE_URL } from '@env';

const baseUrl = SUPABASE_URL?.trim() ?? '';
const apiKey = SUPABASE_ANON_KEY?.trim() ?? SUPABASE_API_KEY?.trim() ?? '';

export const supabaseConfig = {
  baseUrl,
  apiKey,
  feedbackFunctionPath: 'functions/v1/submit-feedback',
};

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseConfig.baseUrl && supabaseConfig.apiKey);
}
