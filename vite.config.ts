import { execSync } from "node:child_process";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

function readCommitHash(): string {
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "dev";
  }
}

const commitHash = readCommitHash();
const buildDate = new Date().toISOString();

export default defineConfig({
  base: "/",
  define: {
    __APP_VERSION__: JSON.stringify(commitHash),
    __BUILD_DATE__: JSON.stringify(buildDate),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src/sw",
      filename: "index.ts",
      registerType: "autoUpdate",
      injectRegister: false,
      manifest: false, // using public/manifest.json
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
      },
      devOptions: { enabled: false, type: "module" },
    }),
  ],
  build: {
    outDir: "dist",
    rollupOptions: {
      output: {
        // Selten ändernde Vendor-Libs vom App-Code trennen, damit sie bei
        // App-Updates im Service-Worker-Cache (registerType: 'autoUpdate')
        // erhalten bleiben. Reihenfolge beachten: react-router vor react,
        // da dessen Pfad ebenfalls "react" enthält.
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("react-router") || id.includes("/@remix-run/")) {
            return "vendor-router";
          }
          if (id.includes("/react-dom/") || id.includes("/react/") || id.includes("/scheduler/")) {
            return "vendor-react";
          }
          if (id.includes("/idb")) return "vendor-db";
        },
      },
    },
  },
});
