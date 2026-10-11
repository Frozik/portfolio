/**
 * Exports shaped as each source writes them (headers,
 * quoting, field names), with made-up data: no importer code or data is
 * taken from other password managers.
 */

export const CHROME_CSV = [
  'name,url,username,password,note',
  'github.com,https://github.com/login,octo@example.com,Pa55-word!,',
  '"Bank, personal",https://online.examplebank.eu/,jane,"pass,with""quote","first line',
  'second line"',
  'broken,row',
  '',
].join('\r\n');

export const FIREFOX_CSV = [
  '"url","username","password","httpRealm","formActionOrigin","guid","timeCreated","timeLastUsed","timePasswordChanged"',
  '"https://accounts.example.org","jane@example.org","s3cret-firefox","","https://accounts.example.org","{0f5a3c1e-0000-4000-8000-000000000001}","1700000000000","1700000500000","1700000000000"',
  '',
].join('\n');

export const SAFARI_CSV = [
  'Title,URL,Username,Password,Notes,OTPAuth',
  'example.com (jane),https://example.com/,jane,hunter2-but-longer,Safari note,otpauth://totp/Example:jane?secret=JBSWY3DPEHPK3PXP&issuer=Example',
  '',
].join('\n');

export const BITWARDEN_JSON = JSON.stringify({
  encrypted: false,
  folders: [{ id: 'folder-work', name: 'Work' }],
  items: [
    {
      id: 'item-login',
      folderId: 'folder-work',
      type: 1,
      reprompt: 1,
      name: 'Example login',
      notes: 'login notes',
      favorite: true,
      fields: [
        { name: 'Recovery email', value: 'backup@example.com', type: 0, linkedId: null },
        { name: 'Security answer', value: 'blue', type: 1, linkedId: null },
        { name: 'Has 2FA', value: 'true', type: 2, linkedId: null },
        { name: 'Linked username', value: null, type: 3, linkedId: 100 },
      ],
      login: {
        uris: [
          { match: null, uri: 'https://login.example.com' },
          { match: 3, uri: 'https://example.com/exact' },
        ],
        username: 'jane',
        password: 'correct horse battery staple',
        totp: 'JBSWY3DPEHPK3PXP',
        fido2Credentials: [{ credentialId: 'abc' }],
      },
      collectionIds: null,
      creationDate: '2024-03-01T10:00:00.000Z',
      revisionDate: '2024-03-02T10:00:00.000Z',
      deletedDate: null,
    },
    {
      id: 'item-note',
      folderId: null,
      type: 2,
      reprompt: 0,
      name: 'Wi-Fi at the cottage',
      notes: 'The router is in the attic.',
      favorite: false,
      secureNote: { type: 0 },
      archivedDate: '2025-01-01T00:00:00.000Z',
    },
    {
      id: 'item-card',
      folderId: null,
      type: 3,
      name: 'Travel card',
      notes: null,
      card: {
        cardholderName: 'Jane Doe',
        brand: 'Visa',
        number: '4111111111111111',
        expMonth: '7',
        expYear: '2029',
        code: '123',
      },
    },
    {
      id: 'item-identity',
      folderId: 'folder-work',
      type: 4,
      name: 'Passport',
      identity: {
        title: 'Ms',
        firstName: 'Jane',
        middleName: null,
        lastName: 'Doe',
        address1: '1 Example Street',
        city: 'Berlin',
        postalCode: '10115',
        country: 'DE',
        email: 'jane@example.com',
        passportNumber: 'X1234567',
      },
    },
    {
      id: 'item-ssh',
      type: 5,
      name: 'Build server key',
      sshKey: {
        privateKey:
          '-----BEGIN OPENSSH PRIVATE KEY-----\nmade up\n-----END OPENSSH PRIVATE KEY-----',
        publicKey: 'ssh-ed25519 AAAA made-up',
        keyFingerprint: 'SHA256:made-up',
      },
    },
    { id: 'item-future', type: 9, name: 'A kind from the future' },
  ],
});

export const BITWARDEN_ENCRYPTED_JSON = JSON.stringify({
  encrypted: true,
  passwordProtected: true,
  salt: 'c2FsdA==',
  kdfType: 0,
  kdfIterations: 600000,
  encKeyValidation_DO_NOT_EDIT: '2.made-up',
  data: '2.made-up',
});

export const BITWARDEN_CSV = [
  'folder,favorite,type,name,notes,fields,reprompt,login_uri,login_username,login_password,login_totp',
  'Social,1,login,Example social,,"Pet: cat\nCity: Paris",0,"https://social.example,https://m.social.example",jane,pw-social,',
  ',,note,Locker code,Code is 4512,,1,,,,',
  '',
].join('\n');

export const SAFEINCLOUD_XML = `<?xml version="1.0" encoding="utf-8"?>
<database>
<label name="Business" id="1" type="business" />
<label name="Shopping" id="2" />
<card title="Example mail" symbol="email" color="blue" star="true" id="10">
<field name="Login" type="login" autofill="username">jane@example.com</field>
<field name="Password" type="password" autofill="current-password"> 0042 &amp; spaces </field>
<field name="Website" type="website" autofill="url">mail.example.com</field>
<field name="One-time password" type="one_time_password">JBSWY3DPEHPK3PXP</field>
<field name="Security answer" type="secret">blue</field>
<notes>Recovery:
call support</notes>
<label_id>1</label_id>
<label_id>2</label_id>
<file name="recovery-codes.txt">bWFkZSB1cA==</file>
</card>
<card title="Travel card" symbol="card" color="purple" id="11">
<field name="Number" type="number">4111111111111111</field>
<field name="Expiry" type="expiry">07/29</field>
<field name="PIN" type="pin">1234</field>
</card>
<card title="Login template" template="true" id="12">
<field name="Login" type="login"></field>
</card>
<card title="Gone" deleted="true" id="13">
<field name="Login" type="login">old</field>
</card>
</database>
`;
