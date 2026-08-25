.rules

## Project State (Aug 25 2026)

### Architecture: injection only
- **Standalone Electron app removed** (Aug 2026). YouCord is now a pure client mod injected into Discord Desktop.
- Deleted: `src/youcord/`, `src/renderer/` (old standalone renderer), `src/preload/`, `index.js`,
  `youcord-index.js`, `youcord-preload.js`, `electron-builder.config.cjs`, `scripts/build/buildDesktop.mts`,
  `scripts/build/{vencordDep,includeDirPlugin}.mts`, `scripts/build/injectReact.mjs`, `scripts/build/{afterPack,sandboxFix}.mjs`,
  `static/views|tray|bin|badges|multi-instance`, `static/splash.webp`.
- `build.mjs` now only builds the 3 injection targets (`dist/desktop/{patcher,renderer,preload}.js` + `desktop.asar`).
- tsconfig aliases removed: `@equicord/types*`, `@YouCord/types*`, bare `main/*`, `renderer/*`, `shared/*`.
- Utilities recovered into kept code: `src/main/mediaPermissions.ts` (rewritten clean),
  `makeLinksOpenExternally` already existed at `src/main/utils/externalLinks.ts`,
  `ContributeModal.tsx` moved to `src/components/settings/tabs/vencord/`.

### What's been done
- **Malware cleanup**: TokenImporter, WorldBomb, VB-Cable, PowerShell Bypass removed
- **CI updated**: Node 22, pnpm v11.11.0 (from packageManager field)
- **ESLint**: 0 errors, react-hooks warnings (set to warn level)
- **pnpm migration**: `package.json#pnpm` -> `pnpm-workspace.yaml`, all settings migrated
- **Root cleanup**: ~200 standalone/debug files deleted (scratch, duplicate icons, base64 dumps, py patch scripts)
- **Release workflow**: builds youcord-dist.zip (injection) + YouCord-Installer.exe (.NET) + browser extension. No more NSIS/portable/dmg.

### Current status
- `pnpm build` -> SUCCESS (injection build only)
- `pnpm testTsc` -> pre-existing type errors remain in plugin code (build works, typecheck incomplete)
- `pnpm lint` -> 0 errors
- Injection pipeline: `pnpm inject` / `uninject` / `repair` via `scripts/runInstaller.mjs` (requires dist/desktop/patcher.js)

### Remaining
- Pre-existing TS errors in some plugins (TS2339, TS2769, TS2345, TS2322) - build works, typecheck fails on those
