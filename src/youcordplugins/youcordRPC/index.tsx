import definePlugin from "@utils/types";
import { FluxDispatcher } from "@webpack/common";

const APP_ID = "1529869867640029386";
const IMAGE_URL = "https://i.ibb.co/6cbzxqsn/68747470733a2f2f692e6962622e636f2f52344857637059482f436861742d4750542d496d6167652d31322d6a75696c2d32.png";
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
            assets: {
                large_image: `mp:external/youcord/${encodeURIComponent(IMAGE_URL)}`,
                large_text: "YouCord"
            },
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
