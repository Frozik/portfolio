/// <reference types="vite/client" />
/// <reference lib="webworker" />

/** A build made to retire every installed copy: it clears the caches and unregisters itself. */
declare const __KILL_SWITCH__: boolean;
