# WebMCP

A page that says which demos of this site work with browser AI agents through
[WebMCP](https://developer.chrome.com/docs/ai/webmcp) and lists every tool
each one registers. It links to Chrome Help on letting Gemini in Chrome act on
pages (for visitors) and to the WebMCP documentation (for developers); how to
turn WebMCP on is left to those pages: the steps change with every Chrome release, and a page cannot
link to `chrome://flags` anyway.

Live: [https://frozik.github.io/portfolio/webmcp](https://frozik.github.io/portfolio/webmcp) · Part of the [portfolio](../../../../../README.md) monorepo; code lives in `apps/portfolio/src/features/webmcp/`.

The WebMCP badge in the top bar of a demo with its own tools links here. The
page is text only, in English and Russian; tool names stay as the agent sees
them, their descriptions are translated. `presentation/tool-catalog.ts` lists
the tools per demo, and `app/agent-tool-catalog.test.ts` builds the real tool
sets and fails when the list and the code drift apart.
