import { webDavAddressProblem } from './webdav-address';

describe('WebDAV address', () => {
  it('takes an HTTPS folder, and plain HTTP only on this machine', () => {
    expect(webDavAddressProblem('https://cloud.example.org/remote.php/dav/files/me/')).toBeNull();
    expect(webDavAddressProblem('http://localhost:8080/')).toBeNull();
    expect(webDavAddressProblem('http://nas.local/dav/')).toBe('insecure');
  });

  it('says when there is no address, or not a web one', () => {
    expect(webDavAddressProblem('  ')).toBe('empty');
    expect(webDavAddressProblem('cloud.example.org')).toBe('invalid');
    expect(webDavAddressProblem('ftp://cloud.example.org/')).toBe('invalid');
    expect(webDavAddressProblem('https://cloud.example.org/Vault%')).toBe('invalid');
  });
});
