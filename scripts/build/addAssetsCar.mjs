import { copyFile, readdir } from "fs/promises";
import { existsSync } from "fs";

/**
 * @param {{
 *   readonly appOutDir: string;
 *   readonly arch: Arch;
 *   readonly electronPlatformName: string;
 *   readonly outDir: string;
 *   readonly packager: PlatformPackager;
 *   readonly targets: Target[];
 * }} context
 */
export async function addAssetsCar({ appOutDir }) {
    if (process.platform !== "darwin") return;

    const appName = (await readdir(appOutDir)).find(item => item.endsWith(".app"));

    if (!appName) {
        console.warn(`Could not find .app directory in ${appOutDir}. Skipping adding assets.car`);
        return;
    }

    const assetsCar = "build/Assets.car";
    if (!existsSync(assetsCar)) {
        console.warn(`[addAssetsCar] ${assetsCar} not found — skipping`);
        return;
    }
    await copyFile(assetsCar, `${appOutDir}/${appName}/Contents/Resources/Assets.car`);
}
