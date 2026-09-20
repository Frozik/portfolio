/// <reference types="vite/client" />
// The WebGPU globals used to arrive through tf.js's own typings; with tf.js
// gone the app that calls WebGPU has to ask for them itself.
/// <reference types="@webgpu/types" />

/** Stamped by `vite-plugins/app-version.ts` at build time: the release tag or `git describe`. */
declare const __APP_VERSION__: string;
