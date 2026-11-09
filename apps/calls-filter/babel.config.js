// Metro and jest both compile through Expo's preset: TypeScript, Flow in React Native's own files, JSX.
// Jest runs modules in a VM without `import()`; there it becomes a `require`, while Metro still splits.
module.exports = api => {
  const test = api.env('test');
  return {
    presets: ['babel-preset-expo'],
    plugins: test ? ['@babel/plugin-transform-dynamic-import'] : [],
  };
};
