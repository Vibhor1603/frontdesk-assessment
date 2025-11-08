const fs = require("fs");
const path = require("path");
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const generate = require("@babel/generator").default;

// Directories to scan
const directories = [
  "frontend/src",
  "backend/src",
  "backend/scripts",
  "admin-dashboard/src",
];

// Track statistics
const stats = {
  filesScanned: 0,
  filesModified: 0,
  importsRemoved: 0,
  errors: [],
};

/**
 * Get all JS/JSX files in a directory recursively
 */
function getJsFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) {
    return fileList;
  }

  const files = fs.readdirSync(dir);

  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      // Skip node_modules and dist directories
      if (file !== "node_modules" && file !== "dist") {
        getJsFiles(filePath, fileList);
      }
    } else if (file.endsWith(".js") || file.endsWith(".jsx")) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

/**
 * Parse file and detect unused imports
 */
function analyzeFile(filePath) {
  try {
    const code = fs.readFileSync(filePath, "utf8");

    // Parse the code into an AST
    const ast = parser.parse(code, {
      sourceType: "module",
      plugins: ["jsx", "typescript"],
    });

    const importedIdentifiers = new Map(); // Map of identifier -> import node
    const usedIdentifiers = new Set();
    let hasChanges = false;

    // First pass: collect all imported identifiers
    traverse(ast, {
      ImportDeclaration(path) {
        path.node.specifiers.forEach((specifier) => {
          if (specifier.type === "ImportDefaultSpecifier") {
            importedIdentifiers.set(specifier.local.name, {
              node: path.node,
              specifier: specifier,
              type: "default",
            });
          } else if (specifier.type === "ImportSpecifier") {
            importedIdentifiers.set(specifier.local.name, {
              node: path.node,
              specifier: specifier,
              type: "named",
            });
          } else if (specifier.type === "ImportNamespaceSpecifier") {
            importedIdentifiers.set(specifier.local.name, {
              node: path.node,
              specifier: specifier,
              type: "namespace",
            });
          }
        });
      },
    });

    // Second pass: find all identifier usages
    traverse(ast, {
      Identifier(path) {
        // Skip if this identifier is part of an import declaration
        if (
          path.parent.type === "ImportSpecifier" ||
          path.parent.type === "ImportDefaultSpecifier" ||
          path.parent.type === "ImportNamespaceSpecifier"
        ) {
          return;
        }

        // Skip if this is a property key in an object (not a reference)
        if (
          path.parent.type === "ObjectProperty" &&
          path.parent.key === path.node &&
          !path.parent.computed
        ) {
          return;
        }

        // Mark this identifier as used
        usedIdentifiers.add(path.node.name);
      },
      JSXIdentifier(path) {
        // JSX components are also identifiers
        usedIdentifiers.add(path.node.name);
      },
    });

    // Third pass: remove unused imports
    const unusedImports = [];
    traverse(ast, {
      ImportDeclaration(path) {
        const unusedSpecifiers = [];

        path.node.specifiers.forEach((specifier) => {
          const localName = specifier.local.name;
          if (!usedIdentifiers.has(localName)) {
            unusedSpecifiers.push(specifier);
          }
        });

        if (unusedSpecifiers.length > 0) {
          if (unusedSpecifiers.length === path.node.specifiers.length) {
            // Remove entire import statement
            unusedImports.push({
              source: path.node.source.value,
              specifiers: unusedSpecifiers.map((s) => s.local.name),
            });
            path.remove();
            hasChanges = true;
          } else {
            // Remove only unused specifiers
            path.node.specifiers = path.node.specifiers.filter(
              (spec) => !unusedSpecifiers.includes(spec)
            );
            unusedImports.push({
              source: path.node.source.value,
              specifiers: unusedSpecifiers.map((s) => s.local.name),
              partial: true,
            });
            hasChanges = true;
          }
        }
      },
    });

    if (hasChanges) {
      // Generate new code from modified AST
      const output = generate(ast, {
        retainLines: true,
        comments: true,
      });

      // Write back to file
      fs.writeFileSync(filePath, output.code, "utf8");

      stats.filesModified++;
      stats.importsRemoved += unusedImports.length;

      console.log(`✓ ${filePath}`);
      unusedImports.forEach((imp) => {
        const specifiers = imp.specifiers.join(", ");
        const action = imp.partial ? "Removed specifiers" : "Removed import";
        console.log(`  ${action}: ${specifiers} from '${imp.source}'`);
      });
    }

    stats.filesScanned++;
    return { hasChanges, unusedImports };
  } catch (error) {
    stats.errors.push({ file: filePath, error: error.message });
    // Only log errors for non-test files to reduce noise
    if (!filePath.includes("test") && !filePath.includes("Test")) {
      console.error(`✗ Error processing ${filePath}: ${error.message}`);
    }
    stats.filesScanned++;
    return { hasChanges: false, unusedImports: [] };
  }
}

/**
 * Main execution
 */
function main() {
  console.log("Starting unused import removal...\n");

  // Collect all JS/JSX files
  const allFiles = [];
  directories.forEach((dir) => {
    const files = getJsFiles(dir);
    allFiles.push(...files);
  });

  console.log(`Found ${allFiles.length} JavaScript/JSX files to analyze\n`);

  // Process each file
  allFiles.forEach((file) => {
    analyzeFile(file);
  });

  // Print summary
  console.log("\n" + "=".repeat(60));
  console.log("SUMMARY");
  console.log("=".repeat(60));
  console.log(`Files scanned: ${stats.filesScanned}`);
  console.log(`Files modified: ${stats.filesModified}`);
  console.log(`Imports removed: ${stats.importsRemoved}`);
  console.log(`Errors: ${stats.errors.length}`);

  if (stats.errors.length > 0) {
    console.log("\nErrors encountered:");
    stats.errors.forEach((err) => {
      console.log(`  ${err.file}: ${err.error}`);
    });
  }

  console.log("\n✓ Unused import removal complete!");
}

// Run the script
main();
