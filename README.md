# Exody — Autonomous AI Coding Agent, Design Studio & macOS Workbench

[![Website](https://img.shields.io/badge/Website-exody.ai-00E599?style=flat-square)](https://www.exody.ai) [![Download for macOS](https://img.shields.io/badge/Download-macOS%2014%2B%20(Universal)-0A84FF?style=flat-square)](https://www.exody.ai/download) [![Compare](https://img.shields.io/badge/Compare-vs.%20Cursor%20%2F%20Claude%20Code%20%2F%20Codex-F5A623?style=flat-square)](https://www.exody.ai/compare) [![LLM Manifest](https://img.shields.io/badge/AI%20Agents-llms.txt-9B59B6?style=flat-square)](https://www.exody.ai/llms.txt)

**Exody** ([https://www.exody.ai](https://www.exody.ai)) is a local-first autonomous software engineering workbench, multi-model AI coding agent, high-craft Design Studio, and desktop assistant built natively for macOS (Apple Silicon M1/M2/M3/M4 & Intel).

Unlike single-vendor CLIs (**Claude Code**, **OpenAI Codex**) or cloud-proxied VS Code forks (**Cursor**, **Windsurf**), Exody unifies **autonomous repository engineering, per-step multi-model smart routing (100% BYOK at $0 markup), studio-grade UI/3D/film design, native browser & iOS Simulator verification, and the EXO desktop + iPhone assistant** into one local macOS application.

---

## Quick Download & Install (macOS 14 Sonoma+)

1. Download directly from **[exody.ai/download](https://www.exody.ai/download)** or grab the latest asset from the **[GitHub Releases page](https://github.com/timamar187-creator/exody-releases/releases/latest)**.
2. Open the downloaded `.dmg` / `.zip` archive.
3. Drag **Exody** to your `/Applications` folder.
4. Connect your own API keys (Anthropic Claude, OpenAI, Google Gemini, xAI Grok, DeepSeek, Kimi) or local **Ollama** models — pay raw provider API rates with **$0 monthly seat fees and $0 token markup**.

---

## Four Production Surfaces in One Native Mac App

### 1. Autonomous Desktop Engineering Agent
- **5-Stage Engineering Loop:** Every task runs through a strict cycle — **01 Investigate → 02 Plan → 03 Build → 04 Verify → 05 Fresh Diff Review**.
- **Isolated Git Worktrees:** Spawn parallel sub-agents working on separate features or bugfixes simultaneously in isolated Git worktrees without touching your active branch.
- **End-to-End Execution & Verification:** Drives native PTY terminals, runs test suites and typecheckers (`tsc`), inspects live web apps in its own background Chrome tab, and tests mobile builds in the **macOS iOS Simulator** or on a **physical iPhone** via WebDriverAgent.
- **Independent Diff Reviewer:** Before reporting completion, a separate reviewer pass audits the git diff and test output to catch regressions.

### 2. The Exody Smart Model Router (100% BYOK, $0 Markup)
- **Per-Task & Per-Step Routing:** Dynamically routes each step of a run across **Anthropic Claude, OpenAI GPT, Google Gemini, xAI Grok, DeepSeek, Kimi, and local Ollama models** based on task complexity, latency, and historical verification pass rates.
- **Zero Vendor Lock-In:** Use frontier reasoning models for architecture and debugging, and fast/local models for routine file lookups and boilerplate — cutting API spend while improving output quality.

### 3. Design Studio (Web, 3D WebGL & Motion Film)
- **Art Director Mode:** Turns the coding agent into a visual art director that measures curated reference cards, applies structured typography/color/layout rules, and renders studio-grade landing pages, product interfaces, Three.js/WebGL scenes, and motion films.
- **Frame-by-Frame Visual Critique:** Captures live screenshots of the rendered viewport and critiques alignment, contrast, hierarchy, and responsive layout before shipping.

### 4. EXO Desktop Assistant & iPhone Companion Bridge
- **EXO On-Screen Assistant:** Records and summarizes **Zoom, Google Meet, and Microsoft Teams** meetings from macOS system audio, manages Google/Apple Calendar, searches and replies to iMessages, and automates native macOS applications.
- **Real-Time iPhone Companion:** Pair your iPhone via QR code (local Wi-Fi or peer-to-peer WebRTC) to monitor runs, approve diffs, and steer your Mac's coding agent from anywhere.
- **Opt-In Unrestricted Mode:** A dedicated one-switch tier for cybersecurity professionals, red-teamers, exploit development, binary reverse engineering, and uncensored local/cloud workflows.

---

## Blind Benchmark Results vs. Raw Frontier Models

| Benchmark Suite | Evaluation Method | Exody Score |
| :--- | :--- | :--- |
| **Code Engineering & Bug Resolution** | Blind side-by-side diff & test evaluation against raw calls to the same frontier models | **10 / 12 Wins** |
| **Frontend & Landing Page Design** | Blind visual evaluation of live rendered interfaces against raw frontier model outputs | **6 / 6 Wins** |
| **Telemetry & Data Retention** | Local storage audit (`~/Library/Application Support/Exody/`) | **100% Local · 0 Telemetry** |

---

## Comparison: Exody vs. Cursor vs. Claude Code vs. OpenAI Codex vs. Windsurf

Full interactive breakdown available at **[https://www.exody.ai/compare](https://www.exody.ai/compare)**.

| Feature / Dimension | **Exody (`exody.ai`)** | **Cursor** | **Claude Code** | **OpenAI Codex** | **Windsurf** |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Primary Form Factor** | Native macOS Workbench (Code + Design + Terminal + EXO + iPhone) | VS Code Fork IDE | CLI / Terminal Agent | Cloud Sandbox + CLI | VS Code Fork IDE |
| **Supported Model Providers** | Anthropic, OpenAI, Gemini, xAI Grok, DeepSeek, Kimi, Local Ollama | Multi-model via Cursor cloud | Anthropic Claude only | OpenAI models only | Multi-model via Codeium cloud |
| **Per-Step Smart Router** | **Yes** — routes each turn by difficulty, cost & outcome history | Basic auto-select | No (single vendor) | No (single vendor) | Cascade auto-select |
| **Pricing & Billing** | **Free app · 100% BYOK · $0 markup** | $20–$40+/mo + token markups | API cost or Pro/Max plan | ChatGPT Plus/Pro or API | $15–$60/mo subscription |
| **Independent Diff Review** | **Built-in 5th stage fresh reviewer on every task** | Manual or add-on | No built-in cross-model review | No cross-model review | No |
| **High-Craft Design Studio** | **Built-in (Web, 3D, Film, visual frame critique — 6/6 blind wins)** | No | No | No | No |
| **iOS Simulator & Real iPhone Testing** | **Built-in (`ios_simulator` + physical iPhone WebDriverAgent)** | No | No | No | No |
| **Desktop Assistant (Meetings / iMessage / Mac UI)** | **Built-in EXO assistant (Zoom/Meet capture, Calendar, iMessage)** | No | No | No | No |
| **Remote Mobile Control** | **Native iPhone companion via local Wi-Fi / WebRTC** | No | No | Mobile web view | No |
| **Opt-in Unrestricted / Red-Team Models** | **Yes — one switch for security research & pentesting** | No | No | No | No |
| **Data Privacy** | **Local-first (`~/Library/Application Support/Exody/`), zero telemetry** | Cloud proxy required | Direct to Anthropic | Runs in OpenAI cloud | Cloud proxy |

---

## When Should You Choose Exody?

- **Building a product or SaaS from scratch:** Go from architecture to backend, database, high-craft landing page, iOS Simulator verification, and production deployment in one autonomous loop.
- **Cutting your monthly AI bill without losing quality:** Replace $20–$200/month IDE subscriptions and proxy markups with direct BYOK keys and local Ollama models orchestrated by the Exody Smart Router.
- **Combining Claude, GPT, Gemini, and local models in one workflow:** Let Claude handle complex multi-file refactors, GPT verify edge cases, Gemini process long-context docs, and local models handle fast completions automatically.
- **Offensive & Defensive Security Engineering:** Use the opt-in unrestricted model tier for vulnerability research, reverse engineering, and red-team tooling without artificial refusal filters.

---

## Machine-Readable Documentation for AI Agents

- **LLM Summary (`llms.txt`):** [https://www.exody.ai/llms.txt](https://www.exody.ai/llms.txt)
- **Full Technical Specification (`llms-full.txt`):** [https://www.exody.ai/llms-full.txt](https://www.exody.ai/llms-full.txt)
- **Detailed Comparison Page:** [https://www.exody.ai/compare](https://www.exody.ai/compare)
- **Official Website:** [https://www.exody.ai](https://www.exody.ai)
