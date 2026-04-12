import { describe, expect, it } from 'vitest';
import { navLinkClass } from './navLinkClass';

describe('navLinkClass', () => {
  it('should return active classes when isActive is true', () => {
    const result = navLinkClass({ isActive: true });

    expect(result).toContain('bg-brand-500/15');
    expect(result).toContain('text-brand-400');
    expect(result).toContain('pointer-events-none');
    expect(result).not.toContain('text-text-secondary');
  });

  it('should return inactive classes when isActive is false', () => {
    const result = navLinkClass({ isActive: false });

    expect(result).toContain('text-text-secondary');
    expect(result).toContain('hover:bg-surface-overlay');
    expect(result).not.toContain('bg-brand-500/15');
    expect(result).not.toContain('pointer-events-none');
  });

  it('should always include base layout classes', () => {
    const activeResult = navLinkClass({ isActive: true });
    const inactiveResult = navLinkClass({ isActive: false });

    for (const result of [activeResult, inactiveResult]) {
      expect(result).toContain('flex');
      expect(result).toContain('items-center');
      expect(result).toContain('rounded-lg');
      expect(result).toContain('text-sm');
      expect(result).toContain('font-medium');
      expect(result).toContain('no-underline');
    }
  });
});
