import { describe, expect, it } from 'vitest';
import { getIconElement } from './getIconElement';

describe('getIconElement', () => {
  it('should return undefined for undefined iconName', () => {
    expect(getIconElement(undefined)).toBeUndefined();
  });

  it('should return undefined for unknown iconName', () => {
    expect(getIconElement('unknown-icon')).toBeUndefined();
  });

  it('should return Eye element for "eye" iconName', () => {
    const element = getIconElement('eye');

    expect(element).toBeDefined();
    expect(element?.type).toBeDefined();
  });

  it('should return Network element for "network" iconName', () => {
    const element = getIconElement('network');

    expect(element).toBeDefined();
    expect(element?.type).toBeDefined();
  });
});
