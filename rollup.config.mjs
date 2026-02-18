import resolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import * as fs from "fs";

export default {
  input: "src/main.ts",
  output: {
    dir: "com.dzarlax.ai-assistant.sdPlugin/bin",
    format: "esm",
    preserveModules: false,
    entryFileNames: "plugin.js",
    sourcemap: true
  },
  plugins: [
    json(),
    resolve({
      exportConditions: ["node"],
      preferBuiltins: true
    }),
    commonjs(),
    typescript({
      tsconfig: "./tsconfig.json"
    }),
    // Copy static files after build
    {
      name: "copy-static",
      writeBundle: async () => {
        const dest = "com.dzarlax.ai-assistant.sdPlugin";

        // Ensure directories exist
        const dirs = [
          dest,
          `${dest}/imgs`,
          `${dest}/ui`,
          `${dest}/ui/js`,
          `${dest}/bin`
        ];
        dirs.forEach(dir => {
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
        });

        // Copy manifest
        fs.copyFileSync("manifest.json", `${dest}/manifest.json`);

        // Create package.json for ESM support in root folder
        fs.writeFileSync(`${dest}/package.json`, '{ "type": "module" }');

        // Copy images
        if (fs.existsSync("images")) {
          const imgs = fs.readdirSync("images");
          for (const img of imgs) {
            if (img.endsWith(".png") || img.endsWith(".svg")) {
              fs.copyFileSync(`images/${img}`, `${dest}/imgs/${img}`);
            }
          }
        }

        // Copy property-inspector files
        if (fs.existsSync("property-inspector")) {
          const uiFiles = fs.readdirSync("property-inspector");
          for (const file of uiFiles) {
            if (file === "js") {
              const jsFiles = fs.readdirSync("property-inspector/js");
              for (const jsFile of jsFiles) {
                fs.copyFileSync(`property-inspector/js/${jsFile}`, `${dest}/ui/js/${jsFile}`);
              }
            } else {
              fs.copyFileSync(`property-inspector/${file}`, `${dest}/ui/${file}`);
            }
          }
        }

        // Copy global-settings files
        if (fs.existsSync("global-settings")) {
          const gsFiles = fs.readdirSync("global-settings");
          for (const file of gsFiles) {
            if (file === "js") {
              const jsFiles = fs.readdirSync("global-settings/js");
              for (const jsFile of jsFiles) {
                fs.copyFileSync(`global-settings/js/${jsFile}`, `${dest}/ui/js/${jsFile}`);
              }
            } else if (file.endsWith(".html")) {
              // Rename index.html to global-settings.html for the UI folder
              const destName = file === "index.html" ? "global-settings.html" : file;
              fs.copyFileSync(`global-settings/${file}`, `${dest}/ui/${destName}`);
            } else {
              fs.copyFileSync(`global-settings/${file}`, `${dest}/ui/${file}`);
            }
          }
        }

        console.log("Static files copied!");
      }
    }
  ],
  external: []
};
