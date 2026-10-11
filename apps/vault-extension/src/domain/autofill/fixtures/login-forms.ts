/**
 * Pages the detector must read right, written after the
 * real ones (their structure, not their code). Each marks the fields it
 * expects filled with `data-expect`: `username`, `password` or `otp`.
 */
export interface IFormFixture {
  readonly name: string;
  readonly html: string;
  readonly kind: 'login' | 'username' | 'otp' | 'sign-up' | 'none';
}

export const LOGIN_FORMS: readonly IFormFixture[] = [
  {
    name: 'Google, the account step',
    kind: 'username',
    html: `<form><input type="email" name="identifier" autocomplete="username webauthn" aria-label="Email or phone" data-expect="username"><button>Next</button></form>`,
  },
  {
    name: 'Google, the password step (the account kept hidden for password managers)',
    kind: 'login',
    html: `<form><input type="email" name="identifier" autocomplete="username" hidden value="jane@example.org"><input type="password" name="Passwd" autocomplete="current-password" aria-label="Enter your password" data-expect="password"></form>`,
  },
  {
    name: 'GitHub',
    kind: 'login',
    html: `<form action="/session"><label for="login_field">Username or email address</label><input type="text" name="login" id="login_field" autocomplete="username" data-expect="username"><label for="password">Password</label><input type="password" name="password" id="password" autocomplete="current-password" data-expect="password"><input type="submit" value="Sign in"></form>`,
  },
  {
    name: 'Yandex ID, the login step',
    kind: 'username',
    html: `<form><input type="text" name="login" id="passp-field-login" placeholder="Логин или email" data-expect="username"><button>Войти</button></form>`,
  },
  {
    name: 'A bank with no autocomplete: login and password by name',
    kind: 'login',
    html: `<form><input type="text" name="search" placeholder="Поиск по сайту"></form><form><input type="text" name="userLogin" placeholder="Логин" data-expect="username"><input type="password" name="userPassword" placeholder="Пароль" data-expect="password"><button>Войти</button></form>`,
  },
  {
    name: 'A phone-number login',
    kind: 'username',
    html: `<form><input type="tel" name="phone" placeholder="Телефон" inputmode="tel" data-expect="username"><button>Продолжить</button></form>`,
  },
  {
    name: 'A one-time code with its autocomplete token',
    kind: 'otp',
    html: `<form><label>Code from the app <input type="text" inputmode="numeric" autocomplete="one-time-code" name="totp" data-expect="otp"></label></form>`,
  },
  {
    name: 'A one-time code split into six boxes',
    kind: 'otp',
    html: `<form><div class="digits">${'<input type="text" inputmode="numeric" maxlength="1" data-expect="otp">'.repeat(6)}</div><button>Verify</button></form>`,
  },
  {
    name: 'A one-time code known only by its placeholder',
    kind: 'otp',
    html: `<form><input type="tel" name="sms" placeholder="Код из СМС" data-expect="otp"></form>`,
  },
  {
    name: 'Sign-up with new-password, never filled with a stored one',
    kind: 'sign-up',
    html: `<form><input type="email" autocomplete="email"><input type="password" autocomplete="new-password"><input type="password" autocomplete="new-password"></form>`,
  },
  {
    name: 'Sign-up without tokens: password and "repeat password"',
    kind: 'sign-up',
    html: `<form><input type="text" name="username"><label>Password <input type="password" name="password"></label><label>Repeat password <input type="password" name="password2"></label></form>`,
  },
  {
    name: 'Password change: the current one only',
    kind: 'login',
    html: `<form><input type="password" autocomplete="current-password" name="old" data-expect="password"><input type="password" autocomplete="new-password" name="new"><input type="password" autocomplete="new-password" name="confirm"></form>`,
  },
  {
    name: 'A honeypot field and a disabled one around the real login',
    kind: 'login',
    html: `<form><input type="text" name="website" style="display:none"><input type="text" name="nickname" disabled><input type="email" name="email" placeholder="Email" data-expect="username"><input type="password" name="pass" data-expect="password"></form>`,
  },
  {
    name: 'A single-page app: no form element, a search box on top',
    kind: 'login',
    html: `<header><input type="search" name="q" placeholder="Search"></header><main><div class="card"><input type="text" placeholder="Username" data-expect="username"><input type="password" placeholder="Password" data-expect="password"><button>Log in</button></div></main>`,
  },
  {
    name: 'A login inside an open shadow root',
    kind: 'login',
    html: `<login-box data-shadow="open"></login-box>`,
  },
  {
    name: 'A login inside a closed shadow root',
    kind: 'login',
    html: `<login-box data-shadow="closed"></login-box>`,
  },
  {
    name: 'A login in a frame: the page itself has nothing to fill',
    kind: 'none',
    html: `<p>Sign in below</p><iframe title="Sign in" src="about:blank"></iframe>`,
  },
  {
    name: 'A search page has nothing to fill',
    kind: 'none',
    html: `<form role="search"><input type="search" name="q" aria-label="Search"><input type="text" name="query" placeholder="Search docs"></form>`,
  },
];

/** The login form a `login-box` element carries in its shadow root. */
export const SHADOW_LOGIN = `<form><input type="text" autocomplete="username" data-expect="username"><input type="password" autocomplete="current-password" data-expect="password"></form>`;
