declare module '*.module.scss' {
  const classes: { readonly [key: string]: string };
  // biome-ignore lint/style/noDefaultExport: CSS modules use default exports by design
  export default classes;
}
