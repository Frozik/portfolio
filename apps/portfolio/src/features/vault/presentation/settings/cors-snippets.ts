import { assertNever } from '@frozik/utils/assert/assertNever';

export type TWebDavServer = 'nextcloud' | 'rclone' | 'apache' | 'nginx' | 'caddy';

const METHODS = 'GET, PUT, DELETE, MKCOL, MOVE, PROPFIND, OPTIONS';
const HEADERS =
  'Authorization, Content-Type, Depth, Destination, Overwrite, If-Match, If-None-Match';

/**
 * What each server needs so this page may call it: its origin
 * allowed, the WebDAV methods and headers let through the preflight, the
 * preflight answered without a password, and the ETag readable. Configuration
 * is not translated; only the names around it are.
 */
export function corsSnippetOf(server: TWebDavServer, origin: string): string {
  switch (server) {
    case 'nextcloud':
      return [
        '# Nextcloud sends no CORS headers for WebDAV by itself.',
        '# 1. Apps → install "WebAppPassword"',
        `# 2. Administration settings → WebAppPassword → allowed origins: ${origin}`,
        '# 3. Personal settings → Security → create an app password for the vault',
        '# Folder address:',
        'https://cloud.example.org/remote.php/dav/files/<user>/Vault/',
      ].join('\n');
    case 'rclone':
      return [
        `rclone serve webdav remote:Vault --addr :8080 \\`,
        `  --user me --pass '<app password>' \\`,
        `  --allow-origin '${origin}'`,
        '# behind HTTPS (a reverse proxy or --cert/--key)',
      ].join('\n');
    case 'apache':
      return [
        '<Location /vault/>',
        '  Dav On',
        `  Header always set Access-Control-Allow-Origin "${origin}"`,
        `  Header always set Access-Control-Allow-Methods "${METHODS}"`,
        `  Header always set Access-Control-Allow-Headers "${HEADERS}"`,
        '  Header always set Access-Control-Expose-Headers "ETag"',
        '  RewriteEngine On',
        '  RewriteCond %{REQUEST_METHOD} OPTIONS',
        '  RewriteRule ^ - [R=204,L]',
        '  AuthType Basic',
        '  AuthName "Vault"',
        '  AuthUserFile /etc/apache2/vault.htpasswd',
        '  <LimitExcept OPTIONS>',
        '    Require valid-user',
        '  </LimitExcept>',
        '</Location>',
      ].join('\n');
    case 'nginx':
      return [
        '# needs nginx-dav-ext-module for PROPFIND',
        'location /vault/ {',
        '  if ($request_method = OPTIONS) {',
        `    add_header Access-Control-Allow-Origin "${origin}" always;`,
        `    add_header Access-Control-Allow-Methods "${METHODS}" always;`,
        `    add_header Access-Control-Allow-Headers "${HEADERS}" always;`,
        '    return 204;',
        '  }',
        `  add_header Access-Control-Allow-Origin "${origin}" always;`,
        '  add_header Access-Control-Expose-Headers "ETag" always;',
        '  dav_methods PUT DELETE MKCOL MOVE;',
        '  dav_ext_methods PROPFIND OPTIONS;',
        '  create_full_put_path on;',
        '  auth_basic "Vault";',
        '  auth_basic_user_file /etc/nginx/vault.htpasswd;',
        '}',
      ].join('\n');
    case 'caddy':
      return [
        '# needs the github.com/mholt/caddy-webdav plugin',
        '{',
        '  order webdav before file_server',
        '}',
        'vault.example.org {',
        `  header Access-Control-Allow-Origin "${origin}"`,
        '  header Access-Control-Expose-Headers "ETag"',
        '  @preflight method OPTIONS',
        '  handle @preflight {',
        `    header Access-Control-Allow-Methods "${METHODS}"`,
        `    header Access-Control-Allow-Headers "${HEADERS}"`,
        '    respond 204',
        '  }',
        '  handle {',
        '    basic_auth {',
        '      me <hash from: caddy hash-password>',
        '    }',
        '    webdav {',
        '      root /srv/vault',
        '    }',
        '  }',
        '}',
      ].join('\n');
    default:
      return assertNever(server);
  }
}

export const WEBDAV_SERVERS: readonly TWebDavServer[] = [
  'nextcloud',
  'rclone',
  'apache',
  'nginx',
  'caddy',
];
