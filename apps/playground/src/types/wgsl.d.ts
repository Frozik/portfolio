declare module '*.wgsl?raw' {
  const source: string;
  // biome-ignore lint/style/noDefaultExport: Vite ?raw imports require default export in ambient module declarations
  export default source;
}
