import definePlugin from "@utils/types";
import { FluxDispatcher } from "@webpack/common";

const APP_ID = "1529869867640029386";
const SOCKET_ID = "YouCordRPC";

function setActivity() {
    FluxDispatcher.dispatch({
        type: "LOCAL_ACTIVITY_UPDATE",
        socketId: SOCKET_ID,
        activity: {
            application_id: APP_ID,
            name: "YouCord",
            details: "Modding Discord",
            state: "Injected ✓",
            timestamps: {
                start: Date.now()
            },
            flags: 1 << 0
        }
    });
}

export default definePlugin({
    name: "YouCordRPC",
    description: "Shows YouCord in your Discord Rich Presence",
    authors: [{ name: "YouCord", id: 0n }],
    enabledByDefault: true,

    start() {
        setActivity();
    },

    stop() {
        FluxDispatcher.dispatch({
            type: "LOCAL_ACTIVITY_UPDATE",
            socketId: SOCKET_ID,
            activity: null
        });
    }
});
