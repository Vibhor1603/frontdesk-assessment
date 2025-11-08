/**
 * Script to update frontend import paths after component reorganization
 * This script updates imports to reflect the new feature-based folder structure
 */

const fs = require("fs");
const path = require("path");

// Mapping of old paths to new paths
const importMappings = {
  // Components moved to features
  "./components/LiveKitVoiceChat":
    "./features/voice/components/LiveKitVoiceChat",
  "./components/UniversalVisualizer":
    "./features/voice/components/UniversalVisualizer",
  "./components/BookingToast": "./features/booking/components/BookingToast",
  "./components/EmailToast": "./features/notifications/components/EmailToast",

  // Relative imports within features (these are already correct)
  "../../notifications/components/EmailToast":
    "../../notifications/components/EmailToast",
  "../../booking/components/BookingToast":
    "../../booking/components/BookingToast",
};

function updateImportsInFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, "utf8");
    let modified = false;

    // Update each import mapping
    for (const [oldPath, newPath] of Object.entries(importMappings)) {
      const oldImportRegex = new RegExp(
        `from ['"]${oldPath.replace(/\./g, "\\.")}['"]`,
        "g"
      );
      const oldDynamicImportRegex = new RegExp(
        `import\\(['"]${oldPath.replace(/\./g, "\\.")}['"]\\)`,
        "g"
      );

      if (oldImportRegex.test(content) || oldDynamicImportRegex.test(content)) {
        content = content.replace(oldImportRegex, `from '${newPath}'`);
        content = content.replace(
          oldDynamicImportRegex,
          `import('${newPath}')`
        );
        modified = true;
      }
    }

    if (modified) {
      fs.writeFileSync(filePath, content, "utf8");
      console.log(`✅ Updated imports in: ${filePath}`);
      return true;
    }

    return false;
  } catch (error) {
    console.error(`❌ Error updating ${filePath}:`, error.message);
    return false;
  }
}

function findJsxFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      // Skip node_modules and dist directories
      if (file !== "node_modules" && file !== "dist") {
        findJsxFiles(filePath, fileList);
      }
    } else if (file.endsWith(".jsx") || file.endsWith(".js")) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

// Main execution
console.log("🔍 Scanning frontend directory for files to update...\n");

const frontendSrcDir = path.join(__dirname, "..", "frontend", "src");
const files = findJsxFiles(frontendSrcDir);

console.log(`Found ${files.length} JavaScript/JSX files\n`);

let updatedCount = 0;
files.forEach((file) => {
  if (updateImportsInFile(file)) {
    updatedCount++;
  }
});

console.log(`\n✨ Import update complete!`);
console.log(`📊 Updated ${updatedCount} file(s)`);
