import { describe, expect, it } from 'vitest';
import { loadConfig } from './config';

const env = (vars: Record<string, string>) => vars as unknown as NodeJS.ProcessEnv;

describe('loadConfig budget', () => {
  it('has no cap by default', () => {
    expect(loadConfig(env({})).maxBudgetUsd).toBeNull();
  });

  it('reads a positive dollar cap', () => {
    expect(loadConfig(env({ FZT_AGENT_MAX_BUDGET_USD: '2.5' })).maxBudgetUsd).toBe(2.5);
  });

  it('treats an unusable cap as no cap rather than NaN', () => {
    for (const value of ['abc', '   ', '-1', '0', 'Infinity']) {
      expect(loadConfig(env({ FZT_AGENT_MAX_BUDGET_USD: value })).maxBudgetUsd).toBeNull();
    }
  });
});
