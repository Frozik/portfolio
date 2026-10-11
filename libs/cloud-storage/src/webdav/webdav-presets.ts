/**
 * Where a known WebDAV service keeps its folder. A hosted service answered
 * with 401 to an anonymous PROPFIND on 2026-10-12 (the endpoint is real), and
 * none of them allows a web page in (no CORS on the preflight) — they reach
 * only clients without that rule, such as the Chrome extension. A server of
 * one's own can be set up to allow the page.
 */
export type TWebDavHosting = 'hosted' | 'self-hosted';

export interface IWebDavPreset {
  readonly id: string;
  readonly name: string;
  /** The folder's address; `{user}` is the login, `{server}` the host of one's own server. */
  readonly endpoint: string;
  readonly hosting: TWebDavHosting;
}

export const WEBDAV_PRESETS: readonly IWebDavPreset[] = [
  {
    id: 'nextcloud',
    name: 'Nextcloud',
    endpoint: 'https://{server}/remote.php/dav/files/{user}/',
    hosting: 'self-hosted',
  },
  {
    id: 'owncloud',
    name: 'ownCloud',
    endpoint: 'https://{server}/remote.php/dav/files/{user}/',
    hosting: 'self-hosted',
  },
  { id: 'seafile', name: 'Seafile', endpoint: 'https://{server}/seafdav/', hosting: 'self-hosted' },
  { id: '4shared', name: '4shared', endpoint: 'https://webdav.4shared.com/', hosting: 'hosted' },
  {
    id: 'cloudme',
    name: 'CloudMe',
    endpoint: 'https://webdav.cloudme.com/{user}/',
    hosting: 'hosted',
  },
  { id: 'gmx', name: 'GMX Cloud', endpoint: 'https://webdav.mc.gmx.net/', hosting: 'hosted' },
  { id: 'koofr', name: 'Koofr', endpoint: 'https://app.koofr.net/dav/Koofr/', hosting: 'hosted' },
  {
    id: 'magentacloud',
    name: 'MagentaCLOUD',
    endpoint: 'https://magentacloud.de/remote.php/webdav/',
    hosting: 'hosted',
  },
  { id: 'mailru', name: 'Mail.Ru', endpoint: 'https://webdav.cloud.mail.ru/', hosting: 'hosted' },
  {
    id: 'mailbox-org',
    name: 'Mailbox.org',
    endpoint: 'https://dav.mailbox.org/servlet/webdav.infostore/',
    hosting: 'hosted',
  },
  { id: 'mydrive', name: 'MyDrive', endpoint: 'https://webdav.mydrive.ch/', hosting: 'hosted' },
  {
    id: 'pcloud-eu',
    name: 'pCloud (EU)',
    endpoint: 'https://ewebdav.pcloud.com/',
    hosting: 'hosted',
  },
  {
    id: 'pcloud-us',
    name: 'pCloud (US)',
    endpoint: 'https://webdav.pcloud.com/',
    hosting: 'hosted',
  },
  {
    id: 'powerfolder',
    name: 'PowerFolder',
    endpoint: 'https://my.powerfolder.com/webdav/',
    hosting: 'hosted',
  },
  {
    id: 'hidrive',
    name: 'Strato HiDrive',
    endpoint: 'https://webdav.hidrive.strato.com/',
    hosting: 'hosted',
  },
  { id: 'webde', name: 'WEB.DE', endpoint: 'https://webdav.smartdrive.web.de/', hosting: 'hosted' },
  {
    id: 'woelkli',
    name: 'wölkli',
    endpoint: 'https://cloud.woelkli.com/remote.php/webdav/',
    hosting: 'hosted',
  },
  { id: 'yandex', name: 'Yandex.Disk', endpoint: 'https://webdav.yandex.ru/', hosting: 'hosted' },
];

export function webDavPresetOf(id: string): IWebDavPreset | undefined {
  return WEBDAV_PRESETS.find(preset => preset.id === id);
}

/** A preset's folder for this login and server; a server typed with its scheme or a trailing slash is taken as the host. */
export function presetEndpoint(
  preset: IWebDavPreset,
  { username, server }: { readonly username: string; readonly server: string }
): string {
  const host = server
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '');
  return preset.endpoint
    .replace('{user}', encodeURIComponent(username.trim()))
    .replace('{server}', host);
}
