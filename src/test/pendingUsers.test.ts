import {
  decrementPendingCount,
  getPendingUserActionErrorMessage,
  removePendingQueueUser,
} from '@/lib/pendingUsers';

describe('pending user helpers', () => {
  it('removes the targeted user from the pending queue', () => {
    const users = [
      { user_id: 'u1', full_name: 'User One' },
      { user_id: 'u2', full_name: 'User Two' },
    ];

    expect(removePendingQueueUser(users, 'u1')).toEqual([
      { user_id: 'u2', full_name: 'User Two' },
    ]);
  });

  it('never decrements pending count below zero', () => {
    expect(decrementPendingCount(3)).toBe(2);
    expect(decrementPendingCount(0)).toBe(0);
  });

  it('maps permission failures to a clear approval message', () => {
    const message = getPendingUserActionErrorMessage('approve', new Error('Insufficient permissions to approve users'));
    expect(message).toContain('permissions');
    expect(message).toContain('manager or admin');
  });

  it('maps backend deployment failures to a clear rejection message', () => {
    const message = getPendingUserActionErrorMessage('reject', new Error('Edge Function returned a non-2xx status code'));
    expect(message).toContain('reject-pending-user');
  });

  it('maps already-processed users to a stable queue message', () => {
    const message = getPendingUserActionErrorMessage('approve', new Error('No pending user matched this action.'));
    expect(message).toBe('This user is no longer pending approval.');
  });
});
