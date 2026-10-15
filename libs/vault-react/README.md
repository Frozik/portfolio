# @frozik/vault-react

The password vault's web widgets, shared by the web renderers (the portfolio's vault, the
Ciphra Vault web app, the extension's popup): the one-time code, the card icon and its
picker, the password generator, the field value editors, large type. They read
`@frozik/vault` types and render with `@frozik/components` controls; the logic stays in
`@frozik/vault` and `@frozik/vault-app`. `sensitive-class` marks elements that hold secrets.
