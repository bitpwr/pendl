import { describe, it, expect } from 'vitest';

describe('Project Setup', () => {
  it('should have basic test infrastructure working', () => {
    expect(1 + 1).toBe(2);
  });

  it('should have access to environment', () => {
    expect(typeof process).toBe('object');
  });
});
