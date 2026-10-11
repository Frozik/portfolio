/** A vault file in a WebDAV folder. */
export interface IWebDavSource {
  readonly folderUrl: string;
  readonly username: string;
  readonly fileName: string;
}

/** Where the vault's file is and the app password: sealed with the vault's key, never kept in the open. */
export interface IWebDavLink {
  readonly source: IWebDavSource;
  readonly password: string;
}

export type TConnectOutcome = 'connected' | 'not-found' | 'not-a-vault' | 'unreachable';

/** What a pull did to the copy: nothing new, a newer file, a file under a key this session no longer has. */
export type TPullOutcome = 'unchanged' | 'updated' | 'rotated' | 'unreachable' | 'no-cloud';
