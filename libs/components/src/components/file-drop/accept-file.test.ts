import { acceptsFile } from './accept-file';

const scan = { name: 'Passport.PNG', type: 'image/png' };
const statement = { name: 'statement.pdf', type: 'application/pdf' };

describe('acceptsFile', () => {
  it('matches extensions, wildcard types and exact types, case aside', () => {
    expect(acceptsFile(scan, '.png')).toBe(true);
    expect(acceptsFile(scan, 'image/*')).toBe(true);
    expect(acceptsFile(statement, 'image/*, application/pdf')).toBe(true);
    expect(acceptsFile(statement, 'image/*,.png')).toBe(false);
  });

  it('takes anything when nothing is listed', () => {
    expect(acceptsFile(statement, undefined)).toBe(true);
    expect(acceptsFile(statement, ' ')).toBe(true);
  });
});
