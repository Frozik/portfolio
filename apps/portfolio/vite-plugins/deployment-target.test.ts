import { parseHostFile, toDeploymentTarget } from './deployment-target.ts';

describe('parseHostFile', () => {
  it('reads KEY=VALUE pairs and ignores comments and blanks', () => {
    const parsed = parseHostFile('# a comment\n\nSSH_HOST=root@1.2.3.4\n  DOMAIN = example.com \n');
    expect(parsed).toEqual({ SSH_HOST: 'root@1.2.3.4', DOMAIN: 'example.com' });
  });

  it('keeps the whole value when it contains an equals sign', () => {
    expect(parseHostFile('URL=https://x/?a=b').URL).toBe('https://x/?a=b');
  });
});

describe('toDeploymentTarget', () => {
  const complete = {
    COMMUNICATION_DOMAIN: 'example.com',
    GOOGLE_OAUTH_CLIENT_ID: 'google-id',
    YANDEX_OAUTH_CLIENT_ID: 'yandex-id',
  };

  it('builds the signaling URL from the declared domain', () => {
    expect(toDeploymentTarget(complete, 'production').communicationUrl).toBe('https://example.com');
  });

  it('leaves the Yandex client empty when the host does not declare one', () => {
    const { YANDEX_OAUTH_CLIENT_ID: _omitted, ...withoutYandex } = complete;
    expect(toDeploymentTarget(withoutYandex, 'production').yandexClientId).toBe('');
  });

  it('refuses a host with no domain rather than building a broken bundle', () => {
    const { COMMUNICATION_DOMAIN: _omitted, ...withoutDomain } = complete;
    expect(() => toDeploymentTarget(withoutDomain, 'staging')).toThrow('staging');
  });

  it('refuses a host with no Google client id', () => {
    const { GOOGLE_OAUTH_CLIENT_ID: _omitted, ...withoutGoogle } = complete;
    expect(() => toDeploymentTarget(withoutGoogle, 'production')).toThrow('GOOGLE_OAUTH_CLIENT_ID');
  });
});
