<div align="center">
  <img src="https://i.ibb.co/R4HWcpYH/Chat-GPT-Image-12-juil-2026-19-31-03-removebg-preview.png" width="96" height="96" alt="YouCord Logo">

# YouCord

**Everything Discord doesn't build, we create.**

[![Telegram](https://img.shields.io/badge/Telegram-Join%20us-26A5E4?logo=telegram&logoColor=white)](https://t.me/youcord)
[![Discord](https://img.shields.io/badge/Discord-Join%20us-5865F2?logo=discord&logoColor=white)](https://discord.gg/mwxsEuEp54)
[![License](https://img.shields.io/badge/license-GPL%20v3-a855f7)](./LICENSE)
[![Website](https://img.shields.io/badge/website-youcord.fr-5865F2?logo=googlechrome&logoColor=white)](https://youcord.fr)
[![Sponsor Graph](https://img.shields.io/badge/sponsor-graph-a855f7?logo=github)](https://github.com/Vendicated/github-sponsor-graph)

[![Version](https://img.shields.io/github/v/release/nightcordlegit/youcord?style=for-the-badge&logo=github&color=22c55e)](https://github.com/nightcordlegit/youcord/releases/latest)
[![Stars](https://img.shields.io/github/stars/nightcordlegit/youcord?style=for-the-badge&logo=github&color=gold)](https://github.com/nightcordlegit/youcord/stargazers)
[![Downloads](https://img.shields.io/github/downloads/nightcordlegit/youcord/total?style=for-the-badge&logo=windows&color=3b82f6)](https://github.com/nightcordlegit/youcord/releases)
[![Commits](https://img.shields.io/github/commit-activity/m/nightcordlegit/youcord?style=for-the-badge&logo=git&color=a855f7)](https://github.com/nightcordlegit/youcord/commits/main)

### Windows · macOS · Linux · Browser Extension · Web

---

</div>

> **⚠️ Avertissement :** YouCord est et restera **100% gratuit**. Si vous avez payé pour obtenir cette application, vous avez été victime d'une arnaque. Nous ne demandons jamais d'argent pour l'accès à nos services. Rejoignez notre Discord officiel pour rester informé : [discord.gg/mwxsEuEp54](https://discord.gg/mwxsEuEp54)

YouCord is a fork of Equicord, which itself builds on top of Vencord. It injects directly into your existing Discord Desktop client — no separate app, no bloat. We stripped out the obfuscation, cleaned things up, added our own improvements, and kept what works.

---

## Table of Contents

- [What's in it](#what's-in-it)
- [Platforms](#platforms)
- [Installation](#installation)
- [Building from source](#building-from-source)
- [Development](#development)
- [Repository](#repository)
- [Contributing](#contributing)
- [Sponsors](#sponsors)
- [Credits](#credits)
- [Disclaimer](#disclaimer)

---

## What's in it

* **Direct injection** — patches your existing Discord Desktop client in place. No separate application needed.
* **Faster startup** — no obfuscation means the client loads noticeably quicker and sits lighter on your CPU and RAM.
* **Auto-updates** — checks for updates in the background on launch and applies them silently.
* **Plugin support** — compatible with the existing Vencord/Equicord plugin ecosystem (600+ plugins across three namespaces).
* **Better audio** — hardware-optimized voice modules for cleaner, louder audio out of the box.
* **Custom styling** — smoother UI, custom icons, and various quality-of-life improvements.
* **Browser extension** — run YouCord as a web extension in Chrome, Firefox, and Edge.
* **Web build** — a standalone web version for desktop browsers.
* **Plugin dev tooling** — auto-generates plugin lists for Vencord, Equicord, and YouCord.

---

## Platforms

| Platform | Support |
|----------|---------|
| **Windows** | ✅ Installer (`YouCord-Installer.exe`) and PowerShell script (`youcord-install.ps1`) |
| **macOS** | ✅ Manual injection via `pnpm inject` |
| **Linux** | ✅ Manual injection via `pnpm inject` |
| **Browser** | ✅ Chrome, Firefox, Edge web extension |
| **Web** | ✅ Standalone web build |

---

## Installation (Windows)

### Option A — Installer (recommended)

1. Download **`YouCord-Installer.exe`** from the [Releases](https://github.com/nightcordlegit/youcord/releases/latest) page
2. Run it, pick your Discord install, done.

### Option B — PowerShell script

1. Download **`youcord-install.ps1`**
2. Right-click → **Run with PowerShell**
3. Follow the steps, restart Discord, done.

### Option C — From source

```bash
git clone https://github.com/nightcordlegit/youcord.git
cd youcord
pnpm install
pnpm build
pnpm inject
```

To restore stock Discord:

```bash
pnpm uninject
```

---

## Building from source

### Requirements

* Git
* Node.js (LTS)
* pnpm

```bash
npm install -g pnpm
```

### Clone & Build

```bash
git clone https://github.com/nightcordlegit/youcord.git
cd youcord
pnpm install
pnpm build
```

### Platform-specific builds

```bash
# Desktop (injection build)
pnpm build

# Browser extension (Chrome, Firefox, Edge)
pnpm buildWebStandalone

# Web-only build
pnpm buildWeb
```

---

## Development

```bash
# Lint & type-check
pnpm lint
pnpm testTsc

# Auto-fix lint issues
pnpm lint:fix

# Watch for changes
pnpm dev

# Inject into Discord (after build)
pnpm inject

# Generate plugin JSON lists
pnpm generatePluginJson

# Generate developer list
pnpm generateDevsList
```

---

## Repository

Source code is hosted at [https://github.com/nightcordlegit/youcord](https://github.com/nightcordlegit/youcord).

Build artifacts and releases are available in the [Releases](https://github.com/nightcordlegit/youcord/releases/latest) section.

---

## Contributors

<!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->
[![All Contributors](https://img.shields.io/badge/all_contributors-0-orange.svg?style=flat-square)](#contributors)
<!-- ALL-CONTRIBUTORS-BADGE:END -->

Thanks goes to these wonderful people ([emoji key](https://allcontributors.org/docs/en/emoji-key)):

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- ALL-CONTRIBUTORS-LIST:END -->

Contributions of any kind welcome!

## Contributing

Contributions are welcome! Please check the [issue tracker](https://github.com/nightcordlegit/youcord/issues) for open bugs and feature requests.

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development guidelines (if available).

---

## Sponsors

You can see the sponsor activity graph for this project here:

[![Sponsor Graph](https://img.shields.io/badge/sponsor-graph-a855f7?logo=github)](https://github.com/Vendicated/github-sponsor-graph)

Generated with [github-sponsor-graph](https://github.com/Vendicated/github-sponsor-graph) by Vendicated.

---

## Credits

YouCord wouldn't exist without [Equicord](https://github.com/Equicord/Equicord) and [Vencord](https://github.com/Vendicated/Vencord). A huge chunk of what makes this work comes directly from their projects. We're fully aware of that and genuinely appreciate everything they've built — we're just taking it in a different direction. Big thanks to everyone who's contributed to both.

### Special Thanks
A massive thank you to the owner of **Illegalcord**, with whom we are proudly partnered. They have been incredibly helpful in brainstorming, sharing ideas, and collaborating on plugins. Our smooth and constructive exchanges have been invaluable, and we want to highlight their exemplary, minimalist work that very few can match.
➡️ [Check out Illegalcord here](https://github.com/ImHisako/Illegalcord)

---

## Disclaimer

*YouCord is not affiliated with Discord Inc. in any way.*

Using third-party clients is technically against Discord's Terms of Service. Use at your own risk.

**The only official YouCord Discord server is [discord.gg/mwxsEuEp54](https://discord.gg/mwxsEuEp54). Any other server claiming to be official is not endorsed by us.**
