import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
import { createCapabilityIssuer, createSc004Handler } from './sc004-handler.mjs';

const projectUrl = Deno.env.get('SUPABASE_URL') || '';
const publicKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
if (!projectUrl || !publicKey || !serviceKey) throw new Error('Required server configuration missing.');
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
// Never inherit request Authorization into the service client.
export const server = createClient(projectUrl, serviceKey, options);
export const expectedAuthIssuer = Deno.env.get('SQ_SC004_AUTH_ISSUER') || projectUrl.replace(/\/$/, '') + '/auth/v1';
export const allowedOrigins = (Deno.env.get('SQ_SC004_BROWSER_ORIGINS') || 'https://tevidentkemp-code.github.io').split(',').map(s => s.trim()).filter(Boolean);
export const getUser = (jwt: string) => createClient(projectUrl, publicKey, options).auth.getUser(jwt);
export const writesEnabled = () => Deno.env.get('SQ_SC004_WRITES_ENABLED') === 'true';
export async function command(args: Record<string, unknown>) {
  const { data, error } = await server.rpc('sq_sc004_command', args);
  if (error) throw Object.assign(new Error('command_failed'), { code: error.code });
  return data;
}
export async function matchHandler() {
  const issueCapability = await createCapabilityIssuer(Deno.env.get('SQ_SC004_ISSUANCE_KEY'));
  return createSc004Handler({ command, getUser, expectedAuthIssuer, allowedOrigins, issueCapability, mutationsEnabled: writesEnabled });
}
