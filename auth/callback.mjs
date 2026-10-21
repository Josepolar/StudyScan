// Show stable, safe messages instead of rendering provider-supplied error descriptions.
export function callbackErrorMessage(address) {
  const url = new URL(address);
  const parameters = [url.searchParams, new URLSearchParams(url.hash.slice(1))];
  const failure = parameters.find(p => p.has('error') || p.has('error_description') || p.has('error_code'));
  if (!failure) return '';
  const code = failure.get('error_code') || failure.get('error') || '';
  if (code === 'access_denied') return 'Google sign-in was cancelled or access was not approved. Please try again.';
  if (['flow_state_expired','flow_state_not_found','bad_code_verifier'].includes(code)) return 'Your sign-in link expired or was opened in a different browser. Start sign-in again in this browser.';
  return 'Google sign-in could not be completed. Please try email sign-in or contact your school administrator.';
}
export function profileRefreshError(currentMessage, account, failure) {
  if (failure) return failure instanceof Error ? failure.message : 'Sign-in could not be verified. Please try again.';
  return account ? '' : currentMessage;
}
