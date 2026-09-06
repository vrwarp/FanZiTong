import { ClientBridge } from './bridge';

describe('ClientBridge', () => {
  it('resolves when the app answers', async () => {
    const sent: { id: string }[] = [];
    const bridge = new ClientBridge({
      send: (frame) => {
        sent.push(frame);
        return true;
      },
      timeoutMs: 1000,
    });
    const promise = bridge.call('deck_overview', {});
    bridge.settle(sent[0].id, { ok: true, result: { total: 3 } });
    await expect(promise).resolves.toEqual({ ok: true, result: { total: 3 } });
  });

  it('queues calls while the app is detached and sends them on reattach', async () => {
    let attached = false;
    const sent: { id: string }[] = [];
    const bridge = new ClientBridge({
      send: (frame) => {
        if (!attached) return false;
        sent.push(frame);
        return true;
      },
      timeoutMs: 1000,
    });
    const promise = bridge.call('deck_search', { query: '奶茶' });
    expect(sent).toHaveLength(0);

    attached = true;
    bridge.flush();
    expect(sent).toHaveLength(1);
    bridge.settle(sent[0].id, { ok: true, result: [] });
    await expect(promise).resolves.toMatchObject({ ok: true });
  });

  it('times out instead of hanging the turn', async () => {
    vi.useFakeTimers();
    try {
      const bridge = new ClientBridge({ send: () => true, timeoutMs: 50 });
      const promise = bridge.call('deck_overview', {});
      vi.advanceTimersByTime(60);
      const result = await promise;
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/did not answer/);
    } finally {
      vi.useRealTimers();
    }
  });

  it('fails everything outstanding when it closes', async () => {
    const bridge = new ClientBridge({ send: () => false, timeoutMs: 10_000 });
    const promise = bridge.call('deck_overview', {});
    bridge.close();
    await expect(promise).resolves.toMatchObject({ ok: false });
    await expect(bridge.call('deck_overview', {})).resolves.toMatchObject({ ok: false });
  });
});
