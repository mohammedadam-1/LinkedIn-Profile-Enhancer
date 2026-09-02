import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), "");

    return {
        plugins: [react()],

        server: {
            port: 5173,
            proxy: {
                "/api": {
                    target: "http://localhost:3001",
                    changeOrigin: true,
                },
            },
        },

        build: {
            outDir: env.VITE_BUILD_OUT_DIR || "dist",
            emptyOutDir: true,
        },
    };
});