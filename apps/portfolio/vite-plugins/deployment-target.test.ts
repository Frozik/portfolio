import { toDeploymentTarget } from './deployment-target.ts';

describe('toDeploymentTarget', () => {
  const complete = {
    COMMUNICATION_DOMAIN: 'example.com',
    GOOGLE_OAUTH_CLIENT_ID: 'google-id',
    YANDEX_OAUTH_CLIENT_ID: 'yandex-id',
  };
  const host = (values: Readonly<Record<string, string>>) => ({ name: 'production', values });

  it('builds the signaling URL from the declared domain', () => {
    expect(toDeploymentTarget(host(complete)).communicationUrl).toBe('https://example.com');
  });

  it('leaves the Yandex client empty when the host does not declare one', () => {
    const { YANDEX_OAUTH_CLIENT_ID: _omitted, ...withoutYandex } = complete;
    expect(toDeploymentTarget(host(withoutYandex)).yandexClientId).toBe('');
  });

  it('leaves the vault without Google Drive when the host declares no vault client', () => {
    expect(toDeploymentTarget(host(complete)).googleVaultClientId).toBe('');
    expect(
      toDeploymentTarget(host({ ...complete, GOOGLE_VAULT_CLIENT_ID: 'vault-id' }))
        .googleVaultClientId
    ).toBe('vault-id');
  });

  it('refuses a host with no domain rather than building a broken bundle', () => {
    const { COMMUNICATION_DOMAIN: _omitted, ...withoutDomain } = complete;
    expect(() => toDeploymentTarget(host(withoutDomain))).toThrow('COMMUNICATION_DOMAIN');
  });

  it('refuses a host with no Google client id', () => {
    const { GOOGLE_OAUTH_CLIENT_ID: _omitted, ...withoutGoogle } = complete;
    expect(() => toDeploymentTarget(host(withoutGoogle))).toThrow('GOOGLE_OAUTH_CLIENT_ID');
  });
});
