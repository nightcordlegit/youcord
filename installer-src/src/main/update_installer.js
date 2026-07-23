import {dialog, shell} from "electron";
import phin from "phin";
const semverGreaterThan = require("semver/functions/gt");
const {version} = require("../../package.json");

const getJSON = phin.defaults({
    method: "GET",
    parse: "json",
    headers: {"User-Agent": `YouCord Installer/${version}`},
    followRedirects: true
});

const GITHUB_LATEST_URL = "https://api.github.com/repos/nightcordlegit/youcord/releases/latest";

export default async function () {
    console.info(`YouCord Installer ${version}`);

    try {
        const response = await getJSON(GITHUB_LATEST_URL);
        const latestRelease = response.body;
        const latestVersion = latestRelease.tag_name;

        if (semverGreaterThan(latestVersion, version)) {
            console.info(`Found new release ${latestVersion}`);

            const result = await dialog.showMessageBox({
                title: "New Installer Version Available",
                message: `A new version of the YouCord installer is available. Click "Download" to download the newest version.`,
                buttons: ["Download", "Later"],
                defaultId: 0,
                cancelId: 1
            });

            if (result.response === 0) {
                await shell.openExternal(latestRelease.html_url);
                process.exit(0);
            }

        }
        else {
            console.info(`The installer is up to date.`);
        }
    }
    catch (err) {
        console.error("Failed to check for updates.", err);
    }
}
