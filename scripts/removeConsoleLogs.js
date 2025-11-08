const fs = require("fs");
const path = require("path");

// Directories to process
const directories = [
  "frontend/src",
  "backend/src",
  "backend/scripts",
  "backend/agent",
  "admin-dashboard/src",
];

// Statistics
const stats = {
  filesProcessed: 0,
  filesModified: 0,
  logsRemoved: 0,
  warnsRemoved: 0,
  infosRemoved: 0,
  commentedRemoved: 0,
};

/**
 * Recursively get all JS/JSX files in a directory
 */
function getJsFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) {
    console.log(`Directory not found: ${dir}`);
    return fileList;
  }

  const files = fs.readdirSync(dir);

  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      // Skip node_modules and dist directories
      if (file !== "node_modules" && file !== "dist" && file !== "build") {
        getJsFiles(filePath, fileList);
      }
    } else if (file.endsWith(".js") || file.endsWith(".jsx")) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

/**
 * Remove console statements from code
 */
function removeConsoleStatements(content) {
  let modified = false;
  let newContent = content;

  // Remove console.log statements (including multiline)
  const logMatches = content.match(/console\.log\([^)]*\);?/g);
  if (logMatches) {
    stats.logsRemoved += logMatches.length;
    modified = true;
  }
  newContent = newContent.replace(/\s*console\.log\([^)]*\);?\s*/g, "");

  // Remove console.warn statements
  const warnMatches = content.match(/console\.warn\([^)]*\);?/g);
  if (warnMatches) {
    stats.warnsRemoved += warnMatches.length;
    modified = true;
  }
  newContent = newContent.replace(/\s*console\.warn\([^)]*\);?\s*/g, "");

  // Remove console.info statements
  const infoMatches = content.match(/console\.info\([^)]*\);?/g);
  if (infoMatches) {
    stats.infosRemoved += infoMatches.length;
    modified = true;
  }
  newContent = newContent.replace(/\s*console\.info\([^)]*\);?\s*/g, "");

  // Remove commented-out console statements
  const commentedMatches = content.match(
    /\/\/\s*console\.(log|warn|info)\([^)]*\);?/g
  );
  if (commentedMatches) {
    stats.commentedRemoved += commentedMatches.length;
    modified = true;
  }
  newContent = newContent.replace(
    /\s*\/\/\s*console\.(log|warn|info)\([^)]*\);?\s*/g,
    ""
  );

  // Clean up excessive blank lines (more than 2 consecutive)
  newContent = newContent.replace(/\n{3,}/g, "\n\n");

  return { content: newContent, modified };
}

/**
 * Process a single file
 */
function processFile(filePath) {
  stats.filesProcessed++;

  const content = fs.readFileSync(filePath, "utf8");
  const { content: newContent, modified } = removeConsoleStatements(content);

  if (modified) {
    fs.writeFileSync(filePath, newContent, "utf8");
    stats.filesModified++;
    console.log(`✓ Modified: ${filePath}`);
  }
}

/**
 * Main execution
 */
function main() {
  console.log("Starting console.log removal...\n");

  directories.forEach((dir) => {
    console.log(`Processing directory: ${dir}`);
    const files = getJsFiles(dir);
    files.forEach(processFile);
    console.log("");
  });

  console.log("=== Cleanup Summary ===");
  console.log(`Files processed: ${stats.filesProcessed}`);
  console.log(`Files modified: ${stats.filesModified}`);
  console.log(`console.log removed: ${stats.logsRemoved}`);
  console.log(`console.warn removed: ${stats.warnsRemoved}`);
  console.log(`console.info removed: ${stats.infosRemoved}`);
  console.log(`Commented console removed: ${stats.commentedRemoved}`);
  console.log(
    `Total statements removed: ${
      stats.logsRemoved +
      stats.warnsRemoved +
      stats.infosRemoved +
      stats.commentedRemoved
    }`
  );
  console.log(
    "\nNote: console.error statements were preserved for error handling."
  );
}

main();
