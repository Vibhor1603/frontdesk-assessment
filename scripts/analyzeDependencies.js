#!/usr/bin/env node

/**
 * Dependency Analysis Script
 * Analyzes the codebase to identify unused files, components, and functions
 */

const fs = require("fs");
const path = require("path");
const { parse } = require("@babel/parser");
const traverse = require("@babel/traverse").default;

// Configuration
const APPS = [
  {
    name: "frontend",
    root: "./frontend/src",
    entryPoints: ["main.jsx", "App.jsx"],
  },
  { name: "backend", root: "./backend/src", entryPoints: ["index.js"] },
  {
    name: "admin-dashboard",
    root: "./admin-dashboard/src",
    entryPoints: ["main.jsx", "App.jsx"],
  },
];

const EXTENSIONS = [".js", ".jsx", ".ts", ".tsx"];

class DependencyAnalyzer {
  constructor() {
    this.fileGraph = new Map(); // absolute path -> { imports, exports, isReachable }
    this.allFiles = new Set();
    this.reachableFiles = new Set();
    this.entryPoints = new Set();
    this.unresolvedImports = [];
  }

  /**
   * Main analysis function
   */
  async analyze() {
    console.log("🔍 Starting codebase analysis...\n");

    // Step 1: Discover all files
    for (const app of APPS) {
      if (fs.existsSync(app.root)) {
        console.log(`📂 Scanning ${app.name}...`);
        this.discoverFiles(app.root, app.name);
      }
    }

    console.log(`\n✅ Found ${this.allFiles.size} files\n`);

    // Step 2: Parse files and build dependency graph
    console.log("🔨 Building dependency graph...");
    for (const filePath of this.allFiles) {
      this.parseFile(filePath);
    }

    console.log(`✅ Parsed ${this.fileGraph.size} files\n`);

    // Step 3: Identify entry points
    console.log("🎯 Identifying entry points...");
    this.identifyEntryPoints();
    console.log(`✅ Found ${this.entryPoints.size} entry points\n`);

    // Step 4: Mark reachable code
    console.log("🌳 Traversing dependency tree...");
    for (const entryPoint of this.entryPoints) {
      this.markReachable(entryPoint);
    }
    console.log(`✅ Marked ${this.reachableFiles.size} reachable files\n`);

    // Step 5: Generate report
    this.generateReport();
  }

  /**
   * Recursively discover all JS/JSX files
   */
  discoverFiles(dir, appName) {
    if (!fs.existsSync(dir)) return;

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Skip node_modules and other common directories
        if (!["node_modules", "dist", "build", ".git"].includes(entry.name)) {
          this.discoverFiles(fullPath, appName);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (EXTENSIONS.includes(ext)) {
          // Use absolute path for consistent comparison
          const absolutePath = path.resolve(fullPath);
          this.allFiles.add(absolutePath);
        }
      }
    }
  }

  /**
   * Parse a file and extract imports/exports
   */
  parseFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, "utf-8");

      const ast = parse(content, {
        sourceType: "module",
        plugins: ["jsx", "typescript"],
      });

      const imports = [];
      const exports = [];

      traverse(ast, {
        ImportDeclaration(path) {
          const source = path.node.source.value;
          const specifiers = path.node.specifiers.map((spec) => {
            if (spec.type === "ImportDefaultSpecifier") {
              return { type: "default", name: spec.local.name };
            } else if (spec.type === "ImportSpecifier") {
              return { type: "named", name: spec.imported.name };
            } else if (spec.type === "ImportNamespaceSpecifier") {
              return { type: "namespace", name: spec.local.name };
            }
          });

          imports.push({ source, specifiers });
        },

        ExportNamedDeclaration(path) {
          if (path.node.declaration) {
            // export const foo = ...
            if (path.node.declaration.declarations) {
              path.node.declaration.declarations.forEach((decl) => {
                if (decl.id) {
                  exports.push({ name: decl.id.name, type: "named" });
                }
              });
            }
            // export function foo() {}
            else if (path.node.declaration.id) {
              exports.push({
                name: path.node.declaration.id.name,
                type: "named",
              });
            }
          }
          // export { foo, bar }
          else if (path.node.specifiers) {
            path.node.specifiers.forEach((spec) => {
              exports.push({ name: spec.exported.name, type: "named" });
            });
          }
        },

        ExportDefaultDeclaration(path) {
          exports.push({ name: "default", type: "default" });
        },
      });

      this.fileGraph.set(filePath, {
        imports,
        exports,
        isReachable: false,
      });
    } catch (error) {
      console.warn(`⚠️  Failed to parse ${filePath}: ${error.message}`);
    }
  }

  /**
   * Identify entry points for each application
   */
  identifyEntryPoints() {
    for (const app of APPS) {
      for (const entryFile of app.entryPoints) {
        const entryPath = path.resolve(path.join(app.root, entryFile));
        if (fs.existsSync(entryPath)) {
          this.entryPoints.add(entryPath);
        }
      }
    }
  }

  /**
   * Mark a file and its dependencies as reachable
   */
  markReachable(filePath) {
    // Already visited
    if (this.reachableFiles.has(filePath)) {
      return;
    }

    this.reachableFiles.add(filePath);

    const fileData = this.fileGraph.get(filePath);
    if (!fileData) {
      return;
    }

    fileData.isReachable = true;

    // Follow imports
    for (const importData of fileData.imports) {
      const resolvedPath = this.resolveImport(filePath, importData.source);
      if (resolvedPath) {
        this.markReachable(resolvedPath);
      } else if (importData.source.startsWith(".")) {
        // Track unresolved local imports for debugging
        this.unresolvedImports.push({
          from: filePath,
          import: importData.source,
        });
      }
    }
  }

  /**
   * Resolve an import path to an actual file path
   */
  resolveImport(fromFile, importPath) {
    // Skip external packages
    if (!importPath.startsWith(".") && !importPath.startsWith("/")) {
      return null;
    }

    const fromDir = path.dirname(fromFile);
    let resolvedPath = path.resolve(fromDir, importPath);

    // Try exact match first
    if (fs.existsSync(resolvedPath)) {
      const stats = fs.statSync(resolvedPath);
      if (stats.isFile()) {
        return resolvedPath;
      }
    }

    // Try with different extensions
    for (const ext of EXTENSIONS) {
      const withExt = resolvedPath + ext;
      if (fs.existsSync(withExt)) {
        return withExt;
      }
    }

    // Try index files
    for (const ext of EXTENSIONS) {
      const indexPath = path.join(resolvedPath, `index${ext}`);
      if (fs.existsSync(indexPath)) {
        return indexPath;
      }
    }

    return null;
  }

  /**
   * Generate analysis report
   */
  generateReport() {
    const unreachableFiles = [];

    for (const filePath of this.allFiles) {
      if (!this.reachableFiles.has(filePath)) {
        const stats = fs.statSync(filePath);
        unreachableFiles.push({
          path: filePath,
          size: stats.size,
        });
      }
    }

    // Sort by size (largest first)
    unreachableFiles.sort((a, b) => b.size - a.size);

    // Calculate totals
    const totalSize = unreachableFiles.reduce(
      (sum, file) => sum + file.size,
      0
    );

    // Categorize unreachable files
    const categories = {
      frontend: {
        components: [],
        hooks: [],
        services: [],
        other: [],
      },
      backend: {
        routes: [],
        services: [],
        other: [],
      },
      adminDashboard: {
        components: [],
        other: [],
      },
    };

    unreachableFiles.forEach((file) => {
      if (file.path.includes("frontend")) {
        if (file.path.includes("components"))
          categories.frontend.components.push(file);
        else if (file.path.includes("hooks"))
          categories.frontend.hooks.push(file);
        else if (file.path.includes("api") || file.path.includes("services"))
          categories.frontend.services.push(file);
        else categories.frontend.other.push(file);
      } else if (file.path.includes("backend")) {
        if (file.path.includes("routes")) categories.backend.routes.push(file);
        else if (file.path.includes("services"))
          categories.backend.services.push(file);
        else categories.backend.other.push(file);
      } else if (file.path.includes("admin-dashboard")) {
        if (file.path.includes("components"))
          categories.adminDashboard.components.push(file);
        else categories.adminDashboard.other.push(file);
      }
    });

    // Generate report
    const report = {
      summary: {
        totalFiles: this.allFiles.size,
        reachableFiles: this.reachableFiles.size,
        unreachableFiles: unreachableFiles.length,
        totalUnreachableSize: totalSize,
        entryPoints: Array.from(this.entryPoints),
      },
      unreachableFiles: unreachableFiles.map((f) => ({
        path: f.path,
        size: f.size,
        sizeKB: (f.size / 1024).toFixed(2),
      })),
      categorized: categories,
      unresolvedImports: this.unresolvedImports.slice(0, 50), // Limit to first 50
    };

    // Write report to file
    const reportPath = "./dependency-analysis-report.json";
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // Print summary
    console.log("📊 ANALYSIS SUMMARY");
    console.log("=".repeat(70));
    console.log(`Total files analyzed:     ${report.summary.totalFiles}`);
    console.log(`Reachable files:          ${report.summary.reachableFiles}`);
    console.log(`Unreachable files:        ${report.summary.unreachableFiles}`);
    console.log(
      `Total unreachable size:   ${(totalSize / 1024).toFixed(2)} KB`
    );
    console.log("=".repeat(70));

    // Print categorized results
    console.log("\n📁 UNREACHABLE FILES BY CATEGORY:\n");

    if (categories.frontend.components.length > 0) {
      console.log("Frontend Components:");
      categories.frontend.components.forEach((f) => {
        console.log(
          `  - ${path.basename(f.path)} (${(f.size / 1024).toFixed(2)} KB)`
        );
      });
      console.log("");
    }

    if (categories.frontend.hooks.length > 0) {
      console.log("Frontend Hooks:");
      categories.frontend.hooks.forEach((f) => {
        console.log(
          `  - ${path.basename(f.path)} (${(f.size / 1024).toFixed(2)} KB)`
        );
      });
      console.log("");
    }

    if (categories.frontend.services.length > 0) {
      console.log("Frontend Services:");
      categories.frontend.services.forEach((f) => {
        console.log(
          `  - ${path.basename(f.path)} (${(f.size / 1024).toFixed(2)} KB)`
        );
      });
      console.log("");
    }

    if (categories.backend.routes.length > 0) {
      console.log("Backend Routes:");
      categories.backend.routes.forEach((f) => {
        console.log(
          `  - ${path.basename(f.path)} (${(f.size / 1024).toFixed(2)} KB)`
        );
      });
      console.log("");
    }

    if (categories.backend.services.length > 0) {
      console.log("Backend Services:");
      categories.backend.services.forEach((f) => {
        console.log(
          `  - ${path.basename(f.path)} (${(f.size / 1024).toFixed(2)} KB)`
        );
      });
      console.log("");
    }

    if (categories.backend.other.length > 0) {
      console.log("Backend Other:");
      categories.backend.other.forEach((f) => {
        console.log(
          `  - ${path.basename(f.path)} (${(f.size / 1024).toFixed(2)} KB)`
        );
      });
      console.log("");
    }

    if (categories.adminDashboard.components.length > 0) {
      console.log("Admin Dashboard Components:");
      categories.adminDashboard.components.forEach((f) => {
        console.log(
          `  - ${path.basename(f.path)} (${(f.size / 1024).toFixed(2)} KB)`
        );
      });
      console.log("");
    }

    if (this.unresolvedImports.length > 0) {
      console.log("\n⚠️  UNRESOLVED LOCAL IMPORTS (sample):");
      console.log("-".repeat(70));
      this.unresolvedImports.slice(0, 15).forEach((imp) => {
        console.log(`  ${path.basename(imp.from)} -> ${imp.import}`);
      });
      if (this.unresolvedImports.length > 15) {
        console.log(`  ... and ${this.unresolvedImports.length - 15} more`);
      }
      console.log(
        "\nNote: These imports could not be resolved. This may indicate:"
      );
      console.log("  - Missing files");
      console.log("  - Incorrect import paths");
      console.log("  - Files outside the scanned directories");
    }

    console.log(`\n✅ Full report saved to: ${reportPath}`);
    console.log("\n💡 Next Steps:");
    console.log("  1. Review the unreachable files list");
    console.log("  2. Check unresolved imports for potential issues");
    console.log("  3. Verify that truly unused files can be safely removed");
    console.log("  4. Consider the impact on runtime dynamic imports");
  }
}

// Run analysis
const analyzer = new DependencyAnalyzer();
analyzer.analyze().catch((error) => {
  console.error("❌ Analysis failed:", error);
  console.error(error.stack);
  process.exit(1);
});
