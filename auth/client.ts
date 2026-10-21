import { createClient } from '@supabase/supabase-js';
import type { Account } from '../lib/types';
declare const __STUDYSCAN_AUTH__: {url:string;key:string}|null;
export type CloudProfile = Account & {is_primary_admin:boolean};
export const authConfig=__STUDYSCAN_AUTH__;
export const authClient = authConfig ? createClient(authConfig.url,authConfig.key,{auth:{flowType:'pkce',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}) : null;
export async function accountProfile():Promise<CloudProfile|null>{
 if(!authClient)return null;
 const {data:{session},error:sessionError}=await authClient.auth.getSession();if(sessionError)throw sessionError;if(!session)return null;
 const {data:{user},error}=await authClient.auth.getUser();if(error)throw error;if(!user)return null;
 if(!user.email_confirmed_at)throw Error('Please confirm your email before signing in.');
 const profile=await authClient.rpc('studyscan_ensure_profile');if(profile.error)throw Error('Your account is signed in, but the StudyScan account database is not ready. Please contact the school administrator.');
 const value=(Array.isArray(profile.data)?profile.data[0]:profile.data) as CloudProfile;
 if(!value||!['super-admin','teacher','student'].includes(value.role))throw Error('Your account profile could not be loaded.');
 if(value.status!=='active')throw Error('Your account is suspended. Contact your school administrator.');
 return value;
}
export async function cloudAdminState(){
 if(!authClient)throw Error('Sign in first.');
 const [accounts,audit]=await Promise.all([authClient.from('studyscan_profiles').select('id,name,email,role,status,is_primary_admin').order('name').limit(2000),authClient.from('studyscan_account_audit').select('id,actor,action,target,created').order('created',{ascending:false}).limit(100)]);
 if(accounts.error||audit.error)throw Error('School accounts could not be loaded. Please refresh and try again.');
 return {accounts:accounts.data as CloudProfile[],audit:audit.data,protectedAccount:(accounts.data as CloudProfile[]).find(a=>a.is_primary_admin)?.id||''};
}
export async function cloudAdminAction(body:Record<string,unknown>){
 if(!authClient)return Response.json({error:'Sign in first.'},{status:401});
 const action=String(body.action);const {error}=await authClient.rpc('studyscan_manage_account',{operation:action,target_id:body.id||null,new_value:body.role||body.status||body.email||''});
 return error?Response.json({error:error.message},{status:403}):Response.json({ok:true});
}
