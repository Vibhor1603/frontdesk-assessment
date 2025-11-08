const fs = require("fs");
const path = require("path");
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;

// Configuration
const ENTRY_POINTS = [
  "frontend/src/main.jsx",
  "frontend/src/App.jsx",
  "backend/src/index.js",
  "admin-dashboard/src/main.jsx",
  "admin-dashboard/src/App.jsx",
];

const DIRECTORIES_TO_SCAN = [
  "frontend/src",
  "backend/src",
  "backend/scripts",
  "admin-dashboard/src",
];

const IGNORE_PATTERNS = ["node_modules", "dist", "build", ".git", "coverage"];

// Data structures
const fileGraph = new Map(); // filePath -> { imports, exports, isReachable }
const unreachableFiles = [];
const unreachableFunctions = [];

/**
 * Check if a path should be ignored
 */
function shouldIgnore(filePath) {
  return IGNORE_PATTERNS.some((pattern) => filePath.includes(pattern));
}

/**
 * Get all JS/JSX files recursively
 */
function getAllJSFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) {
    return fileList;
  }

  const files = fs.readdirSync(dir);

  files.forEach((file) => {
    const filePath = path.join(dir, file);

    if (shouldIgnore(filePath)) {
      return;
    }

    if (fs.statSync(filePath).isDirectory()) {
      getAllJSFiles(filePath, fileList);
    } else if (/\.(js|jsx)$/.test(file)) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

/**
 * Parse a file and extract imports and exports
 */
function parseFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const ast = parser.parse(content, {
      sourceType: "module",
      plugins: ["jsx", "typescript"],
    });

    const imports = [];
    const exports = [];
    const functions = [];

    traverse(ast, {
      ImportDeclaration(path) {
        const source = path.node.source.value;
        const specifiers = path.node.specifiers.map((spec) => {
          if (spec.type === "ImportDefaultSpecifier") {
            return { name: spec.local.name, type: "default" };
          } else if (spec.type === "ImportSpecifier") {
            return { name: spec.imported.name, type: "named" };
          } else if (spec.type === "ImportNamespaceSpecifier") {
            return { name: spec.local.name, type: "namespace" };
          }
        });
        imports.push({ source, specifiers });
      },

      ExportNamedDeclaration(path) {
        if (path.node.declaration) {
          if (path.node.declaration.type === "FunctionDeclaration") {
            exports.push({
              name: path.node.declaration.id.name,
              type: "named",
              kind: "function",
            });
            functions.push(path.node.declaration.id.name);
          } else if (path.node.declaration.type === "VariableDeclaration") {
            path.node.declaration.declarations.forEach((decl) => {
              exports.push({
                name: decl.id.name,
                type: "named",
                kind: "variable",
              });
            });
          }
        }
        if (path.node.specifiers) {
          path.node.specifiers.forEach((spec) => {
            exports.push({
              name: spec.exported.name,
              type: "named",
              kind: "specifier",
            });
          });
        }
      },

      ExportDefaultDeclaration(path) {
        let name = "default";
        if (path.node.declaration.type === "Identifier") {
          name = path.node.declaration.name;
        } else if (
          path.node.declaration.type === "FunctionDeclaration" &&
          path.node.declaration.id
        ) {
          name = path.node.declaration.id.name;
          functions.push(name);
        }
        exports.push({ name, type: "default", kind: "default" });
      },

      FunctionDeclaration(path) {
        if (path.node.id) {
          functions.push(path.node.id.name);
        }
      },

      VariableDeclarator(path) {
        if (
          path.node.init &&
          (path.node.init.type === "ArrowFunctionExpression" ||
            path.node.init.type === "FunctionExpression")
        ) {
          if (path.node.id.type === "Identifier") {
            functions.push(path.node.id.name);
          }
        }
      },
    });

    return { imports, exports, functions, isReachable: false };
  } catch (error) {
    console.error(`Error parsing ${filePath}:`, error.message);
    return {
      imports: [],
      exports: [],
      functions: [],
      isReachable: false,
      error: error.message,
    };
  }
}

/**
 * Resolve import path to absolute file path
 */
function resolveImportPath(importSource, fromFile) {
  // Handle node_modules imports
  if (!importSource.startsWith(".") && !importSource.startsWith("/")) {
    return null; // External dependency
  }

  const fromDir = path.dirname(fromFile);
  let resolvedPath = path.resolve(fromDir, importSource);

  // Try different extensions
  const extensions = ["", ".js", ".jsx", "/index.js", "/index.jsx"];
  for (const ext of extensions) {
    const testPath = resolvedPath + ext;
    if (fs.existsSync(testPath) && fs.statSync(testPath).isFile()) {
      return path.normalize(testPath);
    }
  }

  return null;
}

/**
 * Mark all reachable files from entry points using BFS
 */
function markReachableFiles(entryPoints) {
  const queue = [...entryPoints];
  const visited = new Set();

  while (queue.length > 0) {
    const currentFile = queue.shift();

    if (visited.has(currentFile)) {
      continue;
    }
    visited.add(currentFile);

    const fileData = fileGraph.get(currentFile);
    if (!fileData) {
      continue;
    }

    fileData.isReachable = true;

    // Add all imported files to queue
    fileData.imports.forEach((imp) => {
      const resolvedPath = resolveImportPath(imp.source, currentFile);
      if (resolvedPath && fileGraph.has(resolvedPath)) {
        queue.push(resolvedPath);
      }
    });
  }
}

/**
 * Find unreachable files
 */
function findUnreachableFiles() {
  const unreachable = [];

  fileGraph.forEach((data, filePath) => {
    if (!data.isReachable) {
      const stats = fs.statSync(filePath);
      unreachable.push({
        path: filePath,
        size: stats.size,
        functions: data.functions,
        exports: data.exports,
      });
    }
  });

  return unreachable;
}

/**
 * Find unreachable functions (exported but never imported)
 */
function findUnreachableFunctions() {
  const exportedFunctions = new Map(); // functionName -> [files]
  const importedFunctions = new Set();

  // Collect all exported functions
  fileGraph.forEach((data, filePath) => {
    if (data.isReachable) {
      data.exports.forEach((exp) => {
        if (exp.kind === "function" || exp.type === "default") {
          if (!exportedFunctions.has(exp.name)) {
            exportedFunctions.set(exp.name, []);
          }
          exportedFunctions.get(exp.name).push(filePath);
        }
      });
    }
  });

  // Collect all imported functions
  fileGraph.forEach((data, filePath) => {
    if (data.isReachable) {
      data.imports.forEach((imp) => {
        imp.specifiers.forEach((spec) => {
          importedFunctions.add(spec.name);
        });
      });
    }
  });

  // Find functions that are exported but never imported
  const unreachable = [];
  exportedFunctions.forEach((files, funcName) => {
    if (!importedFunctions.has(funcName) && funcName !== "default") {
      files.forEach((file) => {
        unreachable.push({
          function: funcName,
          file: file,
        });
      });
    }
  });

  return unreachable;
}

/**
 * Generate report
 */
function generateReport() {
  const report = {
    summary: {
      totalFiles: fileGraph.size,
      reachableFiles: 0,
      unreachableFiles: 0,
      totalSize: 0,
      unreachableSize: 0,
    },
    entryPoints: ENTRY_POINTS.filter((ep) => fs.existsSync(ep)),
    unreachableFiles: [],
    unreachableFunctions: [],
    fileGraph: {},
  };

  // Calculate summary
  fileGraph.forEach((data, filePath) => {
    const stats = fs.statSync(filePath);
    report.summary.totalSize += stats.size;

    if (data.isReachable) {
      report.summary.reachableFiles++;
    } else {
      report.summary.unreachableFiles++;
      report.summary.unreachableSize += stats.size;
    }

    // Add to file graph
    report.fileGraph[filePath] = {
      imports: data.imports,
      exports: data.exports,
      functions: data.functions,
      isReachable: data.isReachable,
      size: stats.size,
    };
  });

  report.unreachableFiles = findUnreachableFiles();
  report.unreachableFunctions = findUnreachableFunctions();

  return report;
}

/**
 * Main execution
 */
function main() {
  console.log("🔍 Analyzing codebase...\n");

  // Step 1: Scan all directories and parse files
  console.log("Step 1: Scanning directories and parsing files...");
  DIRECTORIES_TO_SCAN.forEach((dir) => {
    const files = getAllJSFiles(dir);
    console.log(`  Found ${files.length} files in ${dir}`);

    files.forEach((file) => {
      const data = parseFile(file);
      fileGraph.set(path.normalize(file), data);
    });
  });
  console.log(`  Total files parsed: ${fileGraph.size}\n`);

  // Step 2: Identify entry points
  console.log("Step 2: Identifying entry points...");
  const validEntryPoints = ENTRY_POINTS.filter((ep) => {
    const exists = fs.existsSync(ep);
    console.log(`  ${ep}: ${exists ? "✓" : "✗"}`);
    return exists;
  }).map((ep) => path.normalize(ep));
  console.log();

  // Step 3: Mark reachable files
  console.log("Step 3: Marking reachable files from entry points...");
  markReachableFiles(validEntryPoints);
  console.log("  Done\n");

  // Step 4: Generate report
  console.log("Step 4: Generating report...");
  const report = generateReport();

  // Write report to file
  const reportPath = "codebase-analysis-report.json";
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`  Report saved to ${reportPath}\n`);

  // Print summary
  console.log("📊 Analysis Summary:");
  console.log("=".repeat(50));
  console.log(`Total files analyzed: ${report.summary.totalFiles}`);
  console.log(`Reachable files: ${report.summary.reachableFiles}`);
  console.log(`Unreachable files: ${report.summary.unreachableFiles}`);
  console.log(`Total size: ${(report.summary.totalSize / 1024).toFixed(2)} KB`);
  console.log(
    `Unreachable size: ${(report.summary.unreachableSize / 1024).toFixed(2)} KB`
  );
  console.log(`Unreachable functions: ${report.unreachableFunctions.length}`);
  console.log("=".repeat(50));

  // Print unreachable files
  if (report.unreachableFiles.length > 0) {
    console.log("\n🗑️  Unreachable Files:");
    console.log("-".repeat(50));
    report.unreachableFiles.forEach((file) => {
      console.log(`  ${file.path}`);
      console.log(`    Size: ${(file.size / 1024).toFixed(2)} KB`);
      if (file.functions.length > 0) {
        console.log(`    Functions: ${file.functions.join(", ")}`);
      }
    });
  }

  // Print unreachable functions
  if (report.unreachableFunctions.length > 0) {
    console.log("\n🔧 Unreachable Functions (exported but never imported):");
    console.log("-".repeat(50));
    report.unreachableFunctions.forEach((func) => {
      console.log(`  ${func.function} in ${func.file}`);
    });
  }

  console.log("\n✅ Analysis complete!");
}

// Run the analysis
main();
