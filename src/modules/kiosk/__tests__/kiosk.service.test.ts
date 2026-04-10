import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hash } from 'bcryptjs';

describe('kiosk.service', () => {
  beforeEach(() => {
    process.env.TEST_MODE = 'true';
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('unlocks a kiosk worker by PIN and returns context', async () => {
    vi.resetModules();
    const usersRepo = await import('@/repos/users');
    await usersRepo.updateUser('user_test_machinist', {
      kioskEnabled: true,
      kioskPinHash: await hash('1234', 10),
      primaryDepartmentId: 'dept_test_001',
    });

    const { unlockKioskByPin, getKioskSessionContext } = await import('../kiosk.service');
    const unlockResult = await unlockKioskByPin('1234');
    expect(unlockResult.ok).toBe(true);

    const workerId = (unlockResult as { ok: true; data: { worker: { id: string } } }).data.worker.id;
    const contextResult = await getKioskSessionContext(workerId);
    expect(contextResult.ok).toBe(true);
    const context = (contextResult as { ok: true; data: any }).data;
    expect(context.worker.id).toBe('user_test_machinist');
    expect(context.defaultDepartmentId).toBe('dept_test_001');
    expect(Array.isArray(context.departments)).toBe(true);
  });

  it('rejects invalid kiosk PINs', async () => {
    vi.resetModules();
    const { unlockKioskByPin } = await import('../kiosk.service');
    const result = await unlockKioskByPin('9999');
    expect(result.ok).toBe(false);
    expect((result as { ok: false; status: number }).status).toBe(401);
  });

  it('requires explicit switch when worker already has an active timer', async () => {
    vi.resetModules();
    const usersRepo = await import('@/repos/users');
    await usersRepo.updateUser('user_test_machinist', {
      kioskEnabled: true,
      kioskPinHash: await hash('1234', 10),
      primaryDepartmentId: 'dept_test_001',
    });

    const { startKioskTimer } = await import('../kiosk.service');
    const firstResult = await startKioskTimer({
      userId: 'user_test_machinist',
      orderId: 'order_test_002',
      partId: 'part_test_003',
      departmentId: 'dept_test_001',
    });
    expect(firstResult.ok).toBe(true);

    const secondResult = await startKioskTimer({
      userId: 'user_test_machinist',
      orderId: 'order_test_001',
      partId: 'part_test_002',
      departmentId: 'dept_test_002',
    });
    expect(secondResult.ok).toBe(false);
    expect((secondResult as { ok: false; status: number }).status).toBe(409);
    expect(((secondResult as { ok: false; error: any }).error).requiredAction).toBe('switch_confirmation');
  });
});
