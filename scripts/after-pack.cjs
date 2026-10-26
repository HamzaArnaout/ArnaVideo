const fs = require("fs");
const path = require("path");

/**
 * electron-builder skips a node_modules folder at the root of extraResources.
 * Next's standalone server needs that folder, or the window never opens.
 */
module.exports = async function afterPack(context) {
  const src = path.join(context.packager.projectDir, ".next", "standalone", "node_modules");
  const dest = path.join(context.appOutDir, "resources", "app", "node_modules");
  if (!fs.existsSync(src)) {
    throw new Error(`Missing standalone node_modules: ${src}`);
  }
  fs.cpSync(src, dest, { recursive: true, force: true });
  console.log(`Copied standalone node_modules → ${dest}`);
};
