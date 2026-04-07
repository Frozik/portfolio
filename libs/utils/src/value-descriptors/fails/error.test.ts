import { EValueDescriptorErrorCode } from '../codes';

import { ValueDescriptorError } from './error';

describe('ValueDescriptorError', () => {
  it('has message, code, and description', () => {
    const error = new ValueDescriptorError(
      'test message',
      EValueDescriptorErrorCode.NOT_FOUND,
      'detailed description'
    );

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ValueDescriptorError);
    expect(error.message).toBe('test message');
    expect(error.code).toBe(EValueDescriptorErrorCode.NOT_FOUND);
    expect(error.description).toBe('detailed description');
  });

  it('works without description', () => {
    const error = new ValueDescriptorError('no desc', EValueDescriptorErrorCode.UNKNOWN);

    expect(error.message).toBe('no desc');
    expect(error.code).toBe(EValueDescriptorErrorCode.UNKNOWN);
    expect(error.description).toBeUndefined();
  });
});
