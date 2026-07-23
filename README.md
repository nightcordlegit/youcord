<div align="center">
  <img src="https://i.ibb.co/R4HWcpYH/Chat-GPT-Image-12-juil-2026-19-31-03-removebg-preview.png" width="96" height="96" alt="YouCord Logo">

# YouCord

**A custom Discord client built for people who actually care about how Discord runs.**

[![Telegram](https://img.shields.io/badge/Telegram-Join%20us-26A5E4?logo=telegram&logoColor=white)](https://t.me/youcordoff)
[![License](https://img.shields.io/badge/license-GPL%20v3-a855f7)](./LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows-3b82f6.svg?logo=windows&logoColor=white)](https://github.com/nightcordlegit/youcord)
[![Website](https://img.shields.io/badge/website-youcord.fr-5865F2?logo=googlechrome&logoColor=white)](https://youcord.fr)

[![Stars](https://img.shields.io/github/stars/nightcordlegit/youcord?style=for-the-badge&logo=github&color=gold)](https://github.com/nightcordlegit/youcord/stargazers)
[![Downloads](https://img.shields.io/github/downloads/nightcordlegit/youcord/total?style=for-the-badge&logo=windows&color=3b82f6)](https://github.com/nightcordlegit/youcord/releases)
[![Commits](https://img.shields.io/github/commit-activity/m/nightcordlegit/youcord?style=for-the-badge&logo=git&color=a855f7)](https://github.com/nightcordlegit/youcord/commits/main)
[![Release](https://img.shields.io/github/v/release/nightcordlegit/youcord?style=for-the-badge&logo=github&color=22c55e)](https://github.com/nightcordlegit/youcord/releases/latest)

---

</div>

> **⚠️ Warning:** The original YouCord (at source.youcord.fr) has been compromised and contains malware that steals Discord tokens. **This version has been modified to remove that malicious code.** Use only this fork.

YouCord is a fork of Equicord, which itself builds on top of Vencord. We stripped out the obfuscation, cleaned things up, added our own improvements, and kept what works. No bloat, no nonsense.

---

## What's in it

* **Faster startup** — no obfuscation means the client loads noticeably quicker and sits lighter on your CPU and RAM.
* **Auto-updates** — checks for updates in the background on launch and applies them silently.
* **Plugin support** — compatible with the existing plugin ecosystem. Install community plugins straight from Git links.
* **Better audio** — hardware-optimized voice modules for cleaner, louder audio out of the box.
* **Custom styling** — smoother UI, custom icons, and various quality-of-life improvements.

---

## Installation (Windows)

1. Download **`youcord-install.ps1`**
2. Right-click → **Run with PowerShell**
3. Follow the steps, restart Discord, done.

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

### Inject into Discord

```bash
pnpm inject
```

### Restore stock Discord

```bash
pnpm uninject
```

---

## Repository

Source code:

https://github.com/nightcordlegit/youcord

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
