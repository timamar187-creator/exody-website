// Native-module boot for the vendored persona stage. It rides an HTML script
// tag on purpose: vite copies /public untouched, and importing the stage from
// app source would drag it through the bundler's transform pipeline.
import { mountPersona } from "/lib/persona-stage.js";
window.__mountPersona = mountPersona;
window.dispatchEvent(new Event("persona-ready"));
