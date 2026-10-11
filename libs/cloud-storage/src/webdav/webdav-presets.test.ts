import { presetEndpoint, WEBDAV_PRESETS, webDavPresetOf } from './webdav-presets';

describe('WebDAV presets', () => {
  it('fills the login into a hosted service’s folder', () => {
    const cloudMe = webDavPresetOf('cloudme');

    expect(cloudMe && presetEndpoint(cloudMe, { username: 'jane doe', server: '' })).toBe(
      'https://webdav.cloudme.com/jane%20doe/'
    );
  });

  it('builds a self-hosted folder from the server however it was typed', () => {
    const nextcloud = webDavPresetOf('nextcloud');

    expect(
      nextcloud &&
        presetEndpoint(nextcloud, { username: 'jane', server: 'https://cloud.example.org/' })
    ).toBe('https://cloud.example.org/remote.php/dav/files/jane/');
  });

  it('points every service at an https folder, ids unique', () => {
    expect(WEBDAV_PRESETS.every(preset => preset.endpoint.startsWith('https://'))).toBe(true);
    expect(new Set(WEBDAV_PRESETS.map(preset => preset.id)).size).toBe(WEBDAV_PRESETS.length);
  });
});
