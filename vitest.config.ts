import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
    test: {
        include: ["src/**/*.test.ts"],
        globals: true,
    },
    resolve: {
        alias: {
            "@utils": path.resolve(__dirname, "src/utils"),
            "@shared": path.resolve(__dirname, "src/shared"),
            "@webpack/common": path.resolve(__dirname, "src/__mocks__/webpackCommon.ts"),
            "@api": path.resolve(__dirname, "src/api"),
            "@main": path.resolve(__dirname, "src/main"),
            "@components": path.resolve(__dirname, "src/components"),
            "@webpack": path.resolve(__dirname, "src/webpack/webpack"),
            "@debug": path.resolve(__dirname, "src/debug"),
            "@plugins": path.resolve(__dirname, "src/plugins"),
            "@equicord/types": path.resolve(__dirname, "packages/vencord-types/index"),
            "@equicord/types/webpack": path.resolve(__dirname, "packages/vencord-types/webpack-types"),
            "@equicord/types/webpack/common": path.resolve(__dirname, "packages/vencord-types/webpack-common"),
            "@equicord/types/utils": path.resolve(__dirname, "packages/vencord-types/utils-types"),
            "@equicord/types/utils/types": path.resolve(__dirname, "packages/vencord-types/utils-types/types"),
            "@equicord/types/components": path.resolve(__dirname, "packages/vencord-types/components-types"),
            "@YouCord/types": path.resolve(__dirname, "packages/vencord-types/index"),
            "@YouCord/types/webpack": path.resolve(__dirname, "packages/vencord-types/webpack-types"),
            "@YouCord/types/webpack/common": path.resolve(__dirname, "packages/vencord-types/webpack-common"),
            "@YouCord/types/utils": path.resolve(__dirname, "packages/vencord-types/utils-types"),
            "@YouCord/types/utils/types": path.resolve(__dirname, "packages/vencord-types/utils-types/types"),
            "@YouCord/types/components": path.resolve(__dirname, "packages/vencord-types/components-types"),
            "main": path.resolve(__dirname, "src/youcord/main"),
            "shared": path.resolve(__dirname, "src/youcord/shared"),
            "renderer": path.resolve(__dirname, "src/youcord/renderer"),
        },
    },
});
