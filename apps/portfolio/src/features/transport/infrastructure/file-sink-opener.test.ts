import { fileSinkTypeOf } from './file-sink-opener';

describe('echo save type', () => {
  it('offers the type of the file that was sent', () => {
    expect(fileSinkTypeOf({ name: 'report.final.pdf', type: 'application/pdf' })).toEqual({
      description: 'PDF',
      mime: 'application/pdf',
      extension: '.pdf',
    });
  });

  it('keeps the extension when the browser could not tell the MIME type', () => {
    expect(fileSinkTypeOf({ name: 'data.xyz', type: '' })).toEqual({
      description: 'XYZ',
      mime: 'application/octet-stream',
      extension: '.xyz',
    });
  });

  it('applies no filter to a name without a usable extension', () => {
    expect(fileSinkTypeOf({ name: 'Makefile', type: '' })).toBeUndefined();
    expect(fileSinkTypeOf({ name: 'odd.ex-t', type: '' })).toBeUndefined();
  });
});
