export interface PendingQueueUser {
  user_id: string;
}

export function removePendingQueueUser<T extends PendingQueueUser>(users: T[], userId: string) {
  return users.filter((user) => user.user_id !== userId);
}

export function decrementPendingCount(count: number) {
  return Math.max(0, count - 1);
}

export function getPendingUserActionErrorMessage(action: 'approve' | 'reject', error: unknown) {
  const fallback = action === 'approve' ? 'Failed to approve user' : 'Failed to reject pending user';
  const rawMessage = typeof error === 'object' && error && 'message' in error
    ? String((error as { message?: string }).message || fallback)
    : fallback;

  const message = rawMessage.trim();
  const lowered = message.toLowerCase();

  if (
    lowered.includes('insufficient permissions') ||
    lowered.includes('permission') ||
    lowered.includes('row-level security') ||
    lowered.includes('not allowed')
  ) {
    return action === 'approve'
      ? 'Approval failed due to permissions. Please ensure your account has manager or admin approval access.'
      : 'Rejection failed due to permissions. Please ensure your account has manager or admin approval access.';
  }

  if (
    lowered.includes('no pending user matched') ||
    lowered.includes('already approved') ||
    lowered.includes('already deleted') ||
    lowered.includes('already been processed') ||
    lowered.includes('no longer pending')
  ) {
    return 'This user is no longer pending approval.';
  }

  if (
    lowered.includes('approve_user_account') ||
    lowered.includes('reject-pending-user') ||
    lowered.includes('failed to send a request to the edge function') ||
    lowered.includes('edge function returned a non-2xx status code') ||
    lowered.includes('backend is missing') ||
    lowered.includes('apply the latest supabase migrations') ||
    lowered.includes('deploy the reject-pending-user function')
  ) {
    return action === 'approve'
      ? 'Approval backend is missing or outdated. Apply the latest Supabase migrations and retry.'
      : 'Rejection backend is missing or outdated. Apply the latest Supabase migrations and deploy the reject-pending-user function.';
  }

  return message || fallback;
}
