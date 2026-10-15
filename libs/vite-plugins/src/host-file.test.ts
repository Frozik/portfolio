import { parseHostFile, requiredHostValue } from './host-file.ts';

describe('parseHostFile', () => {
  it('reads KEY=VALUE pairs and ignores comments and blanks', () => {
    const parsed = parseHostFile('# a comment\n\nSSH_HOST=root@1.2.3.4\n  DOMAIN = example.com \n');
    expect(parsed).toEqual({ SSH_HOST: 'root@1.2.3.4', DOMAIN: 'example.com' });
  });

  it('keeps the whole value when it contains an equals sign', () => {
    expect(parseHostFile('URL=https://x/?a=b').URL).toBe('https://x/?a=b');
  });
});

describe('requiredHostValue', () => {
  it('refuses a host that leaves the value out or empty, naming both', () => {
    const host = { name: 'staging', values: { EMPTY: '' } };

    expect(() => requiredHostValue(host, 'MISSING')).toThrow(/staging.*MISSING/);
    expect(() => requiredHostValue(host, 'EMPTY')).toThrow('EMPTY');
  });
});
