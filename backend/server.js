const express = require("express");
const cors = require("cors");
const multer = require("multer");
const yauzl = require("yauzl");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { ESLint } = require("eslint");
require("dotenv").config();

const pool = require("./db");

const app = express();
const PORT = process.env.PORT || 5000;

const uploadDir = path.join(__dirname, "uploads");
const projectsDir = path.join(__dirname, "project-files");

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_ENTRIES = 2000;
const MAX_EXTRACTED_SIZE = 100 * 1024 * 1024;
const MAX_COMPRESSION_RATIO = 100;
const MAX_READ_SIZE = 1024 * 1024;

const MAX_ANALYSIS_FILES = 300;
const MAX_ANALYSIS_FILE_SIZE = 1024 * 1024;
const MAX_ANALYSIS_TOTAL_SIZE = 10 * 1024 * 1024;

const ANALYZABLE_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".py",
  ".java",
]);

const IGNORED_DIRECTORIES = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "coverage",
  ".next",
]);

fs.mkdirSync(uploadDir, { recursive: true });
fs.mkdirSync(projectsDir, { recursive: true });

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json({ limit: "100kb" }));

const upload = multer({
  dest: uploadDir,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
  },
  fileFilter: (req, file, callback) => {
    if (path.extname(file.originalname).toLowerCase() !== ".zip") {
      return callback(new Error("Only ZIP files are allowed"));
    }

    callback(null, true);
  },
});

function validateRelativePath(filePath) {
  if (
    typeof filePath !== "string" ||
    !filePath ||
    filePath.includes("\0") ||
    filePath.includes("\\") ||
    filePath.startsWith("/") ||
    /^[a-zA-Z]:/.test(filePath)
  ) {
    throw new Error("Invalid file path");
  }

  const parts = filePath.split("/");

  if (
    parts.some(
      (part) =>
        !part ||
        part === "." ||
        part === ".."
    )
  ) {
    throw new Error("Invalid file path");
  }

  return parts;
}

function ensureInsideRoot(root, target) {
  const resolveRoot = path.resolve(root);
  const resolveTarget = path.resolve(target);
  const relative = path.relative(resolveRoot, resolveTarget);

  if (
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new Error("Path is outside the permitted directory");
  }

  return target;
}

function analyzeJavaScript(content, relativePath) {
  const findings = [];
  const lines = content.split(/\r?\n/);

  const checks = [
    {
      pattern: /\bconsole\s*\.\s*log\s*\(/g,
      severity: "info",
      rule: "debug-console-log",
      message:
        "console.log() found; remove or replace debug logging before production.",
    },
    {
      pattern: /\bdebugger\s*;?/g,
      severity: "warning",
      rule: "debugger-statement",
      message:
        "debugger statement found; remove it before production.",
    },
    {
      pattern: /\beval\s*\(/g,
      severity: "warning",
      rule: "eval-usage",
      message:
        "eval() can execute dynamically constructed code and may create security risks.",
    },
    {
      pattern: /\bvar\s+[A-Za-z_$][\w$]*/g,
      severity: "info",
      rule: "var-declaration",
      message:
        "var declaration found; consider let or const for block-scoped variables.",
    },
  ];

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];

    for (const check of checks) {
      check.pattern.lastIndex = 0;

      let match;

      while ((match = check.pattern.exec(line)) !== null) {
        findings.push({
          file: relativePath,
          line: lineIndex + 1,
          column: match.index + 1,
          severity: check.severity,
          rule: check.rule,
          message: check.message,
          excerpt: line.trim().slice(0, 240),
        });

        if (match[0].length === 0) {
          check.pattern.lastIndex++;
        }
      }
    }
  }

  return findings;
}

function analyzeJSON(content, relativePath) {
  try {
    JSON.parse(content);
    return [];
  } catch (error) {
    const match = error.message.match(/position\s+(\d+)/i);
    const position = match ? Number(match[1]) : 0;
    const beforeError = content.slice(0, position);
    const line = beforeError.split(/\r?\n/).length;
    const lastNewline = beforeError.lastIndexOf("\n");
    const column = position - lastNewline;

    return [{
      file: relativePath,
      line,
      column,
      severity: "error",
      rule: "json/parse-error",
      message: error.message,
      excerpt:
        content.split(/\r?\n/)[line - 1]?.trim().slice(0, 240) || "",
    }];
  }
}

const { spawn } = require("child_process");

function analyzePython(content, relativePath) {
  return new Promise((resolve, reject) => {
    const script = [
      "import ast, sys",
      "source = sys.stdin.read()",
      "try:",
      "    ast.parse(source)",
      "except SyntaxError as e:",
      "    print(f'{e.lineno or 1}|{e.offset or 1}|{e.msg}')",
      "    sys.exit(1)",
      "sys.exit(0)",
    ].join("\n");

    const child = spawn("python", ["-c", script], {
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      child.kill();

      if (!settled) {
        settled = true;
        reject(new Error("Python syntax check timed out."));
      }
    }, 5000);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    child.on("error", (error) => {
      clearTimeout(timer);

      if (!settled) {
        settled = true;
        reject(error);
      }
    });

    child.on("close", (code) => {
      clearTimeout(timer);

      if (settled) return;
      settled = true;

      if (code === 0) {
        resolve([]);
        return;
      }

      const parts = stdout.trim().split("|");
      const line = Number(parts[0]) || 1;
      const column = Number(parts[1]) || 1;

      const message =
        parts.slice(2).join("|") ||
        stderr.trim() ||
        "Python syntax validation failed.";

      resolve([{
        file: relativePath,
        line,
        column,
        severity: "error",
        rule: "python/syntax-error",
        message,
        excerpt: "",
      }]);
    });

    child.stdin.end(content);
  });
}

async function analyzeJava(content, relativePath) {
  const os = require("os");

  const tempDir = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), "devpilot-java-")
  );

  const baseName = path.basename(relativePath);

  try {
    const sourcePath = path.join(tempDir, baseName);
    const outputDir = path.join(tempDir, "classes");

    await fs.promises.mkdir(outputDir, { recursive: true });
    await fs.promises.writeFile(sourcePath, content, "utf8");

    return await new Promise((resolve, reject) => {
      const child = spawn(
        "javac",
        [
          "-proc:none",
          "-Xlint:none",
          "-d",
          outputDir,
          sourcePath,
        ],
        {
          windowsHide: true,
          stdio: ["ignore", "pipe", "pipe"],
          cwd: tempDir,
        }
      );

      let stdout = "";
      let stderr = "";
      let settled = false;

      const timer = setTimeout(() => {
        child.kill();

        if (!settled) {
          settled = true;
          reject(new Error("Java compilation check timed out."));
        }
      }, 8000);

      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");

      child.stdout.on("data", (chunk) => {
        stdout += chunk;
      });

      child.stderr.on("data", (chunk) => {
        stderr += chunk;
      });

      child.on("error", (error) => {
        clearTimeout(timer);

        if (!settled) {
          settled = true;
          reject(error);
        }
      });

      child.on("close", (code) => {
        clearTimeout(timer);

        if (settled) return;
        settled = true;

        if (code === 0) {
          resolve([]);
          return;
        }

        const output = `${stderr}\n${stdout}`.trim();

        const findings = [];
        const pattern = /:(\d+):\s*(error|warning):\s*(.*)/g;

        let match;

        while ((match = pattern.exec(output)) !== null) {
          findings.push({
            file: relativePath,
            line: Number(match[1]) || 1,
            column: 1,
            severity:
              match[2] === "error" ? "error" : "warning",
            rule: "java/compiler-diagnostic",
            message: match[3].trim(),
            excerpt: "",
          });
        }

        resolve(
          findings.length
            ? findings
            : [{
                file: relativePath,
                line: 1,
                column: 1,
                severity: "error",
                rule: "java/compiler-diagnostic",
                message:
                  output.slice(0, 1000) ||
                  "Java compilation check failed.",
                excerpt: "",
              }]
        );
      });
    });
  } finally {
    await fs.promises.rm(tempDir, {
      recursive: true,
      force: true,
    });
  }
}

async function analyzeWithESLint(content, relativePath) {
  const eslint = new ESLint({
    cwd: __dirname,
    overrideConfigFile: path.join(__dirname, "eslint.config.js"),
  });

  // Use a synthetic path rooted in an 'uploaded' subdirectory so ESLint
  // resolves the correct config context and extension-based rules without
  // treating the file as a real file inside the backend source tree.
  const results = await eslint.lintText(content, {
    filePath: path.join(__dirname, "uploaded", relativePath),
  });

  const findings = [];

  for (const result of results) {
    for (const message of result.messages) {
      if (!message.ruleId) {
        continue;
      }

      findings.push({
        file: relativePath,
        line: message.line || 1,
        column: message.column || 1,
        severity:
          message.severity === 2
            ? "error"
            : message.severity === 1
              ? "warning"
              : "info",
        rule: message.ruleId,
        message: message.message,
        excerpt: "",
      });
    }
  }

  return findings;
}

async function findMavenProjectRoot(projectRoot) {
  const pending = [projectRoot];
  let visited = 0;
  const MAX_DIRECTORIES_TO_CHECK = 1000;

  while (pending.length && visited < MAX_DIRECTORIES_TO_CHECK) {
    const directory = pending.shift();
    visited++;

    try {
      const entries = await fs.promises.readdir(directory, {
        withFileTypes: true,
      });

      if (
        entries.some(
          (entry) => entry.isFile() && entry.name === "pom.xml"
        )
      ) {
        return directory;
      }

      entries.sort((a, b) => a.name.localeCompare(b.name));

      for (const entry of entries) {
        if (
          !entry.isDirectory() ||
          entry.isSymbolicLink() ||
          entry.name.startsWith(".") ||
          IGNORED_DIRECTORIES.has(entry.name)
        ) {
          continue;
        }

        const child = path.join(directory, entry.name);
        const realChild = await fs.promises.realpath(child);

        ensureInsideRoot(projectRoot, realChild);
        pending.push(realChild);
      }
    } catch {
      continue;
    }
  }

  return null;
}

// Maven compilation is disabled unless explicitly enabled for trusted projects.
// Maven plugins can execute code, so do not enable this for arbitrary uploads.
async function analyzeMavenProject(projectRoot, mavenRoot) {
  const wrapperName =
    process.platform === "win32" ? "mvnw.cmd" : "mvnw";

  const wrapperPath = path.join(mavenRoot, wrapperName);
  const wrapperStat = await fs.promises.lstat(wrapperPath).catch(() => null);

  if (
    !wrapperStat ||
    !wrapperStat.isFile() ||
    wrapperStat.isSymbolicLink()
  ) {
    return {
      findings: [],
      error: {
        path:
          path.relative(projectRoot, mavenRoot)
            .split(path.sep)
            .join("/") || ".",
        message:
          `Maven project found, but ${wrapperName} is missing. ` +
          "Java files will use standalone javac analysis.",
      },
      usedMaven: false,
    };
  }

  const realWrapper = await fs.promises.realpath(wrapperPath);
  ensureInsideRoot(mavenRoot, realWrapper);

  const outputLimit = 2 * 1024 * 1024;
  const timeoutMs = 90000;

  const result = await new Promise((resolve) => {
    const args = [
      "/d",
      "/c",
      wrapperName,
      "-B",
      "-DskipTests",
      "-Dmaven.compiler.proc=none",
      "compile",
    ];

    const child = spawn("cmd.exe", args, {
      cwd: mavenRoot,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
    });

    let stdout = "";
    let stderr = "";
    let outputBytes = 0;
    let settled = false;

    const finish = (value) => {
      if (settled) return;

      settled = true;
      clearTimeout(timer);
      resolve(value);
    };

    const timer = setTimeout(() => {
      child.kill();

      finish({
        error:
          `Maven compilation timed out after ` +
          `${Math.round(timeoutMs / 1000)} seconds.`,
      });
    }, timeoutMs);

    const collect = (target, chunk) => {
      outputBytes += Buffer.byteLength(chunk, "utf8");

      if (outputBytes > outputLimit) {
        child.kill();
        finish({
          error: "Maven output exceeded the 2 MB analysis limit.",
        });
        return;
      }

      if (target === "stdout") {
        stdout += chunk;
      } else {
        stderr += chunk;
      }
    };

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");

    child.stdout.on("data", (chunk) => collect("stdout", chunk));
    child.stderr.on("data", (chunk) => collect("stderr", chunk));

    child.on("error", (error) => {
      finish({
        error: `Unable to start Maven: ${error.message}`,
      });
    });

    child.on("close", (code) => {
      finish({
        code,
        output: `${stdout}\n${stderr}`,
      });
    });
  });

  if (result.error) {
    return {
      findings: [],
      error: {
        path:
          path.relative(projectRoot, mavenRoot)
            .split(path.sep)
            .join("/") || ".",
        message: result.error,
      },
      usedMaven: false,
    };
  }


  const findings = [];

  const diagnosticPattern =
    /^\[ERROR\]\s+(.+?\.java):\[(\d+),(\d+)\]\s+(.+)$/gm;

  let match;

  while ((match = diagnosticPattern.exec(result.output)) !== null) {
    // Windows Maven output may prefix a drive path with a slash:
    // /D:/folder/File.java -> D:/folder/File.java
    const diagnosticPath = match[1].replace(/^\/([A-Za-z]:\/)/, "$1");

    const absoluteSourcePath = path.resolve(
      mavenRoot,
      diagnosticPath
    );

    const relativeToMaven = path.relative(
      mavenRoot,
      absoluteSourcePath
    );

    if (
      relativeToMaven === ".." ||
      relativeToMaven.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relativeToMaven)
    ) {
      continue;
    }

    const realSourcePath = await fs.promises.realpath(
      absoluteSourcePath
    ).catch(() => null);

    if (!realSourcePath) {
      continue;
    }

    ensureInsideRoot(mavenRoot, realSourcePath);

    const sourceRelativeToRoot = path.relative(
      projectRoot,
      realSourcePath
    );

    if (
      sourceRelativeToRoot === ".." ||
      sourceRelativeToRoot.startsWith(`..${path.sep}`) ||
      path.isAbsolute(sourceRelativeToRoot)
    ) {
      continue;
    }

    const line = Number(match[2]) || 1;
    const column = Number(match[3]) || 1;
    const message = match[4].trim();

    let excerpt = "";

    try {
      const source = await fs.promises.readFile(
        realSourcePath,
        "utf8"
      );

      excerpt = (
        source.split(/\r?\n/)[line - 1] || ""
      ).trim().slice(0, 240);
    } catch {
      // Keep the diagnostic even when the source excerpt is unavailable.
    }

    findings.push({
      file: sourceRelativeToRoot.split(path.sep).join("/"),
      line,
      column,
      severity: "error",
      rule: "java/maven-compiler",
      message,
      excerpt,
    });
  }

  const uniqueFindings = [];
  const seen = new Set();

  for (const finding of findings) {
    const key = [
      finding.file,
      finding.line,
      finding.column,
      finding.message,
    ].join("|");

    if (!seen.has(key)) {
      seen.add(key);
      uniqueFindings.push(finding);
    }
  }

  const errors = [];

  if (result.code !== 0 && uniqueFindings.length === 0) {
    const detail = result.output
      .split(/\r?\n/)
      .filter((line) => /^\[ERROR\]/.test(line))
      .slice(-8)
      .join("\n")
      .slice(0, 1200);

    errors.push({
      path:
        path.relative(projectRoot, mavenRoot)
          .split(path.sep)
          .join("/") || ".",
      message: detail
        ? `Maven compilation failed without a parsed Java source diagnostic:\n${detail}`
        : `Maven compilation exited with code ${result.code} without a parsed Java source diagnostic.`,
    });
  }

  return {
    findings: uniqueFindings,
    errors,
    usedMaven: true,
  };
}

async function analyzeProjectFiles(projectRoot) {
  const findings = [];
  const errors = [];
  const scannedFiles = [];

  let filesSkipped = 0;

  const skipReasons = {
    hiddenEntries: 0,
    ignoredDirectories: 0,
    symbolicLinks: 0,
    unsupportedExtensions: 0,
    oversizedFiles: 0,
    other: 0,
  };

  let totalBytesScanned = 0;
  let fileLimitReached = false;

  const rootStat = await fs.promises.lstat(projectRoot);

  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    throw new Error("Invalid project directory");
  }

  const mavenRoot = await findMavenProjectRoot(projectRoot);
  let mavenResult = null;

  const mavenAnalysisEnabled =
    process.env.DEVPILOT_ENABLE_MAVEN_ANALYSIS === "true";

  if (mavenRoot && mavenAnalysisEnabled) {
    mavenResult = await analyzeMavenProject(projectRoot, mavenRoot);

    findings.push(...mavenResult.findings);

    if (mavenResult.error) errors.push(mavenResult.error);
    if (mavenResult.errors) errors.push(...mavenResult.errors);
  } else if (mavenRoot) {
    errors.push({
      path:
        path.relative(projectRoot, mavenRoot)
          .split(path.sep)
          .join("/") || ".",
      message:
        "Maven project detected, but Maven compilation is disabled. " +
        "Set DEVPILOT_ENABLE_MAVEN_ANALYSIS=true only for trusted projects; " +
        "Maven build plugins may execute code.",
    });
  }

  async function walk(directory) {
    if (
      scannedFiles.length >= MAX_ANALYSIS_FILES ||
      totalBytesScanned >= MAX_ANALYSIS_TOTAL_SIZE
    ) {
      fileLimitReached = true;
      return;
    }

    let entries;

    try {
      entries = await fs.promises.readdir(directory, {
        withFileTypes: true,
      });
    } catch (error) {
      errors.push({
        path:
          path.relative(projectRoot, directory)
            .split(path.sep)
            .join("/") || ".",
        message: `Unable to read directory: ${error.message}`,
      });

      return;
    }

    entries.sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      if (
        scannedFiles.length >= MAX_ANALYSIS_FILES ||
        totalBytesScanned >= MAX_ANALYSIS_TOTAL_SIZE
      ) {
        fileLimitReached = true;
        return;
      }

      if (entry.name.startsWith(".")) {
        filesSkipped++;
        skipReasons.hiddenEntries++;
        continue;
      }

      const absolutePath = path.join(directory, entry.name);

      const relativePath = path.relative(projectRoot, absolutePath)
        .split(path.sep)
        .join("/");

      if (entry.isSymbolicLink()) {
        filesSkipped++;
        skipReasons.symbolicLinks++;
        continue;
      }

      if (entry.isDirectory()) {
        if (IGNORED_DIRECTORIES.has(entry.name)) {
          filesSkipped++;
          skipReasons.ignoredDirectories++;
          continue;
        }

        await walk(absolutePath);
        continue;
      }

      if (!entry.isFile()) {
        filesSkipped++;
        skipReasons.other++;
        continue;
      }

      const extension = path.extname(entry.name).toLowerCase();

      if (!ANALYZABLE_EXTENSIONS.has(extension)) {
        filesSkipped++;
        skipReasons.unsupportedExtensions++;
        continue;
      }

      try {
        const realFilePath = await fs.promises.realpath(absolutePath);

        ensureInsideRoot(projectRoot, realFilePath);

        const stat = await fs.promises.lstat(realFilePath);

        if (!stat.isFile() || stat.isSymbolicLink()) {
          filesSkipped++;
          skipReasons.symbolicLinks++;
          continue;
        }

        if (stat.size > MAX_ANALYSIS_FILE_SIZE) {
          filesSkipped++;
          skipReasons.oversizedFiles++;

          errors.push({
            path: relativePath,
            message: "File exceeds the 1 MB analysis limit.",
          });

          continue;
        }

        if (totalBytesScanned + stat.size > MAX_ANALYSIS_TOTAL_SIZE) {
          fileLimitReached = true;
          return;
        }

        const content = await fs.promises.readFile(
          realFilePath,
          "utf8"
        );

        totalBytesScanned += stat.size;

        scannedFiles.push({
          path: relativePath,
          size: stat.size,
        });

        if ([".js", ".jsx", ".mjs", ".cjs"].includes(extension)) {
          const heuristicFindings = analyzeJavaScript(
            content,
            relativePath
          );

          findings.push(...heuristicFindings);

          try {
            const eslintFindings = await analyzeWithESLint(
              content,
              relativePath
            );

            const duplicateRules = new Set([
              "no-debugger",
              "no-eval",
            ]);

            findings.push(
              ...eslintFindings.filter((item) => {
                if (!duplicateRules.has(item.rule)) {
                  return true;
                }

                const matchingRule =
                  item.rule === "no-debugger"
                    ? "debugger-statement"
                    : "eval-usage";

                return !heuristicFindings.some(
                  (heuristic) =>
                    heuristic.file === item.file &&
                    heuristic.line === item.line &&
                    heuristic.rule === matchingRule
                );
              })
            );
          } catch (eslintError) {
            errors.push({
              path: relativePath,
              message:
                `ESLint analysis failed: ` +
                `${eslintError.message || "Unknown ESLint error"}`,
            });
          }
        } else if (extension === ".json") {
          findings.push(...analyzeJSON(content, relativePath));
        } else if (extension === ".py") {
          findings.push(
            ...(await analyzePython(content, relativePath))
          );
        } else if (extension === ".java") {
          const relativeToMaven = mavenRoot
            ? path.relative(mavenRoot, realFilePath)
            : null;

          const fileIsInMavenProject =
            Boolean(mavenRoot) &&
            relativeToMaven !== ".." &&
            !relativeToMaven.startsWith(`..${path.sep}`) &&
            !path.isAbsolute(relativeToMaven);

          // Maven handles Java files in Maven projects because standalone
          // javac cannot resolve the project's dependencies.
          if (!fileIsInMavenProject) {
            findings.push(
              ...(await analyzeJava(content, relativePath))
            );
          }
        }
      } catch (fileError) {
        errors.push({
          path: relativePath,
          message:
            `File analysis failed: ` +
            `${fileError.message || "Unknown file analysis error"}`,
        });
      }
    }
  }

  await walk(projectRoot);

  const uniqueFindings = [];
  const seenFindings = new Set();

  for (const finding of findings) {
    const key = [
      finding.file,
      finding.line,
      finding.column || 1,
      finding.rule,
      finding.message,
    ].join("|");

    if (!seenFindings.has(key)) {
      seenFindings.add(key);
      uniqueFindings.push(finding);
    }
  }

  return {
    filesScanned: scannedFiles.length,
    filesSkipped,
    skipReasons,
    totalBytesScanned,
    fileLimitReached,
    scannedFiles,
    findings: uniqueFindings,
    errors,
  };
}

function extractZipSafely(zipPath, destination) {
  return new Promise((resolve, reject) => {
    let zipfile;
    let finished = false;
    let entryCount = 0;
    let totalSize = 0;
    let activeReadStream = null;
    let activeWriteStream = null;

    function fail(error) {
      if (finished) return;

      finished = true;

      activeReadStream?.destroy();
      activeWriteStream?.destroy();

      if (zipfile) {
        try {
          zipfile.close();
        } catch { /* intentional: suppress close() errors during failure cleanup */ }
      }

      reject(error);
    }

    yauzl.open(
      zipPath,
      {
        lazyEntries: true,
        validateEntrySizes: true,
        decodeStrings: true,
      },
      (error, archive) => {
        if (error) return fail(error);

        if (!archive) {
          return fail(new Error("Invalid ZIP archive"));
        }

        zipfile = archive;
        zipfile.on("error", fail);

        zipfile.on("end", () => {
          if (finished) return;

          finished = true;
          resolve();
        });

        function nextEntry() {
          if (!finished) {
            zipfile.readEntry();
          }
        }

        zipfile.on("entry", (entry) => {
          if (finished) return;

          entryCount++;

          if (entryCount > MAX_ENTRIES) {
            return fail(new Error("ZIP contains too many entries"));
          }

          const name = entry.fileName;

          if (
            !name ||
            name.includes("\0") ||
            name.includes("\\") ||
            name.startsWith("/") ||
            /^[a-zA-Z]:/.test(name)
          ) {
            return fail(new Error("Unsafe path found in ZIP"));
          }

          const parts = name.split("/");
          const isDirectory = name.endsWith("/");

          const effectiveParts = isDirectory
            ? parts.slice(0, -1)
            : parts;

          if (
            effectiveParts.length === 0 ||
            effectiveParts.some(
              (part) => !part || part === "." || part === ".."
            )
          ) {
            return fail(new Error("Invalid ZIP entry path"));
          }

          const unixMode =
            (entry.externalFileAttributes >>> 16) & 0xffff;

          const fileType = unixMode & 0o170000;

          if (
            fileType &&
            fileType !== 0o100000 &&
            fileType !== 0o040000
          ) {
            return fail(
              new Error("Unsupported special file in ZIP")
            );
          }

          const outputPath = ensureInsideRoot(
            destination,
            path.resolve(destination, ...effectiveParts)
          );

          if (isDirectory) {
            try {
              fs.mkdirSync(outputPath, { recursive: true });
              nextEntry();
            } catch (err) {
              fail(err);
            }

            return;
          }

          if (
            !Number.isSafeInteger(entry.uncompressedSize) ||
            !Number.isSafeInteger(entry.compressedSize) ||
            entry.uncompressedSize < 0 ||
            entry.compressedSize < 0
          ) {
            return fail(new Error("Invalid ZIP entry size"));
          }

          totalSize += entry.uncompressedSize;

          if (totalSize > MAX_EXTRACTED_SIZE) {
            return fail(
              new Error("Extracted ZIP exceeds 100 MB")
            );
          }

          if (
            entry.uncompressedSize > 0 &&
            entry.compressedSize === 0
          ) {
            return fail(new Error("Invalid compression size"));
          }

          if (
            entry.compressedSize > 0 &&
            entry.uncompressedSize / entry.compressedSize >
              MAX_COMPRESSION_RATIO
          ) {
            return fail(
              new Error("ZIP compression ratio is too high")
            );
          }

          try {
            fs.mkdirSync(path.dirname(outputPath), {
              recursive: true,
            });
          } catch (err) {
            return fail(err);
          }

          zipfile.openReadStream(
            entry,
            (streamError, readStream) => {
              if (finished) {
                readStream?.destroy();
                return;
              }

              if (streamError) {
                return fail(streamError);
              }

              activeReadStream = readStream;

              const writeStream = fs.createWriteStream(
                outputPath,
                {
                  flags: "wx",
                  mode: 0o600,
                }
              );

              activeWriteStream = writeStream;

              readStream.on("error", fail);
              writeStream.on("error", fail);

              writeStream.on("finish", () => {
                activeReadStream = null;
                activeWriteStream = null;
                nextEntry();
              });

              readStream.pipe(writeStream);
            }
          );
        });

        nextEntry();
      }
    );
  });
}

async function getUploadedProject(projectId) {
  if (!Number.isSafeInteger(projectId) || projectId <= 0) {
    return null;
  }

  const result = await pool.query(
    `SELECT id, name, upload_path, upload_status
     FROM projects
     WHERE id = $1`,
    [projectId]
  );

  if (!result.rowCount) {
    return null;
  }

  const project = result.rows[0];

  if (
    project.upload_status !== "uploaded" ||
    !project.upload_path
  ) {
    return null;
  }

  const resolvedRoot = path.resolve(project.upload_path);
  const expectedParent = path.resolve(projectsDir);

  if (path.dirname(resolvedRoot) !== expectedParent) {
    throw new Error("Invalid stored project path");
  }

  const realRoot = await fs.promises.realpath(resolvedRoot);
  const realParent = await fs.promises.realpath(expectedParent);

  if (path.dirname(realRoot) !== realParent) {
    throw new Error("Project directory is outside storage");
  }

  const rootStat = await fs.promises.lstat(realRoot);

  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    throw new Error("Invalid project directory");
  }

  return {
    ...project,
    root: realRoot,
  };
}

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Welcome to DevPilot API",
  });
});

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "DevPilot backend is running",
    status: "healthy",
  });
});

app.get("/api/db-health", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT NOW() AS database_time"
    );

    res.status(200).json({
      success: true,
      message: "PostgreSQL connected successfully",
      database: process.env.DB_NAME,
      time: result.rows[0].database_time,
    });
  } catch (error) {
    console.error(
      "Database connection error:",
      error.message
    );

    res.status(500).json({
      success: false,
      message: "Database connection failed",
    });
  }
});

app.get("/api/projects", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, description, created_at,
              upload_status
       FROM projects
       ORDER BY created_at DESC`
    );

    res.json({
      success: true,
      projects: result.rows,
    });
  } catch (error) {
    console.error(
      "Fetch projects error:",
      error.message
    );

    res.status(500).json({
      success: false,
      message: "Failed to fetch projects",
    });
  }
});

app.post("/api/projects", async (req, res) => {
  try {
    const { name, description = "" } = req.body;

    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Project name is required",
      });
    }

    if (name.trim().length > 100) {
      return res.status(400).json({
        success: false,
        message: "Project name cannot exceed 100 characters",
      });
    }

    if (typeof description !== "string") {
      return res.status(400).json({
        success: false,
        message: "Description must be a string",
      });
    }

    const result = await pool.query(
      `INSERT INTO projects (name, description)
       VALUES ($1, $2)
       RETURNING id, name, description, created_at,
                 upload_status`,
      [name.trim(), description.trim()]
    );

    res.status(201).json({
      success: true,
      message: "Project created successfully",
      project: result.rows[0],
    });
  } catch (error) {
    console.error(
      "Create project error:",
      error.message
    );

    res.status(500).json({
      success: false,
      message: "Failed to create project",
    });
  }
});

app.post("/api/projects/:id/upload", (req, res) => {
  upload.single("file")(req, res, async (uploadError) => {
    if (uploadError) {
      return res.status(400).json({
        success: false,
        message: uploadError.message || "File upload failed",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please select a ZIP file",
      });
    }

    let destination = null;
    let previousPath = null;

    try {
      const projectId = Number(req.params.id);

      if (!Number.isSafeInteger(projectId) || projectId <= 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid project ID",
        });
      }

      const projectResult = await pool.query(
        `SELECT id, upload_path
         FROM projects
         WHERE id = $1`,
        [projectId]
      );

      if (!projectResult.rowCount) {
        return res.status(404).json({
          success: false,
          message: "Project not found",
        });
      }

      previousPath = projectResult.rows[0].upload_path;

      destination = path.join(
        projectsDir,
        `${projectId}-${crypto.randomUUID()}`
      );

      fs.mkdirSync(destination, { recursive: false });

      await extractZipSafely(req.file.path, destination);

      await pool.query(
        `UPDATE projects
         SET upload_path = $1,
             upload_status = 'uploaded'
         WHERE id = $2`,
        [destination, projectId]
      );

      if (
        previousPath &&
        path.dirname(path.resolve(previousPath)) ===
          path.resolve(projectsDir) &&
        previousPath !== destination
      ) {
        fs.rmSync(previousPath, {
          recursive: true,
          force: true,
        });
      }

      return res.status(201).json({
        success: true,
        message: "ZIP uploaded and extracted successfully",
        projectId,
      });
    } catch (error) {
      console.error("ZIP processing error:", error.message);

      if (destination) {
        fs.rmSync(destination, {
          recursive: true,
          force: true,
        });
      }

      return res.status(400).json({
        success: false,
        message: error.message || "Failed to process ZIP",
      });
    } finally {
      if (req.file?.path) {
        fs.rmSync(req.file.path, { force: true });
      }
    }
  });
});

app.post("/api/projects/:id/analyze", async (req, res) => {
  try {
    const projectId = Number(req.params.id);

    if (!Number.isSafeInteger(projectId) || projectId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID",
      });
    }

    const project = await getUploadedProject(projectId);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project or uploaded files not found",
      });
    }

    const result = await analyzeProjectFiles(project.root);

    const summary = {
      filesScanned: result.filesScanned,
      filesSkipped: result.filesSkipped,
      skipReasons: result.skipReasons,
      totalBytesScanned: result.totalBytesScanned,
      findings: result.findings.length,
      errors: result.findings.filter(
        (item) => item.severity === "error"
      ).length,
      warnings: result.findings.filter(
        (item) => item.severity === "warning"
      ).length,
      info: result.findings.filter(
        (item) => item.severity === "info"
      ).length,
      fileLimitReached: result.fileLimitReached,
    };

    return res.json({
      success: true,
      projectId,
      projectName: project.name,
      summary,
      scannedFiles: result.scannedFiles,
      findings: result.findings,
      analysisErrors: result.errors,
      note:
        "This is heuristic static analysis, not a complete security audit. Findings may include false positives.",
    });
  } catch (error) {
    console.error("Project analysis error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to analyze project",
    });
  }
});

app.get("/api/projects/:id/files", async (req, res) => {
  try {
    const projectId = Number(req.params.id);

    if (!Number.isSafeInteger(projectId) || projectId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID",
      });
    }

    const project = await getUploadedProject(projectId);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project or uploaded files not found",
      });
    }

    const requestedPath = req.query.path || "";
    let directory = project.root;

    if (requestedPath) {
      const parts = validateRelativePath(requestedPath);

      directory = ensureInsideRoot(
        project.root,
        path.resolve(project.root, ...parts)
      );
    }

    const realDirectory = await fs.promises.realpath(directory);

    ensureInsideRoot(project.root, realDirectory);

    const directoryStat = await fs.promises.lstat(realDirectory);

    if (
      !directoryStat.isDirectory() ||
      directoryStat.isSymbolicLink()
    ) {
      return res.status(400).json({
        success: false,
        message: "Requested path is not a directory",
      });
    }

    const entries = await fs.promises.readdir(realDirectory, {
      withFileTypes: true,
    });

    const files = [];

    for (const entry of entries) {
      if (entry.isSymbolicLink()) {
        continue;
      }

      if (!entry.isDirectory() && !entry.isFile()) {
        continue;
      }

      const entryPath = path.join(realDirectory, entry.name);
      const stat = await fs.promises.lstat(entryPath);

      files.push({
        name: entry.name,
        path: path.relative(project.root, entryPath)
          .split(path.sep)
          .join("/"),
        type: entry.isDirectory() ? "directory" : "file",
        size: entry.isFile() ? stat.size : null,
      });
    }

    files.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === "directory" ? -1 : 1;
      }

      return a.name.localeCompare(b.name);
    });

    res.json({
      success: true,
      projectId,
      path: requestedPath,
      files,
    });
  } catch (error) {
    console.error("List files error:", error.message);

    res.status(400).json({
      success: false,
      message: error.message || "Failed to list project files",
    });
  }
});

app.get("/api/projects/:id/file", async (req, res) => {
  try {
    const projectId = Number(req.params.id);

    if (!Number.isSafeInteger(projectId) || projectId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID",
      });
    }

    const project = await getUploadedProject(projectId);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project or uploaded files not found",
      });
    }

    const parts = validateRelativePath(req.query.path);

    const filePath = ensureInsideRoot(
      project.root,
      path.resolve(project.root, ...parts)
    );

    const realFilePath = await fs.promises.realpath(filePath);

    ensureInsideRoot(project.root, realFilePath);

    const stat = await fs.promises.lstat(realFilePath);

    if (!stat.isFile() || stat.isSymbolicLink()) {
      return res.status(400).json({
        success: false,
        message: "Requested path is not a regular file",
      });
    }

    if (stat.size > MAX_READ_SIZE) {
      return res.status(413).json({
        success: false,
        message: "File is too large to preview (1 MB maximum)",
      });
    }

    const content = await fs.promises.readFile(
      realFilePath,
      "utf8"
    );

    res.json({
      success: true,
      projectId,
      path: req.query.path,
      content,
    });
  } catch (error) {
    console.error("Read file error:", error.message);

    res.status(400).json({
      success: false,
      message: error.message || "Failed to read project file",
    });
  }
});

app.post("/api/projects/:id/file", async (req, res) => {
  try {
    const projectId = Number(req.params.id);
    const { content } = req.body;

    if (!Number.isSafeInteger(projectId) || projectId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID",
      });
    }

    if (typeof content !== "string") {
      return res.status(400).json({
        success: false,
        message: "File content must be a string",
      });
    }

    if (Buffer.byteLength(content, "utf8") > MAX_READ_SIZE) {
      return res.status(413).json({
        success: false,
        message: "File is too large to save (1 MB maximum)",
      });
    }

    const project = await getUploadedProject(projectId);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project or uploaded files not found",
      });
    }

    const parts = validateRelativePath(req.query.path);

    const filePath = ensureInsideRoot(
      project.root,
      path.resolve(project.root, ...parts)
    );

    const realFilePath = await fs.promises.realpath(filePath);

    ensureInsideRoot(project.root, realFilePath);

    const stat = await fs.promises.lstat(realFilePath);

    if (!stat.isFile() || stat.isSymbolicLink()) {
      return res.status(400).json({
        success: false,
        message: "Requested path is not a regular file",
      });
    }

    if (stat.size > MAX_READ_SIZE) {
      return res.status(413).json({
        success: false,
        message: "File is too large to save (1 MB maximum)",
      });
    }

    await fs.promises.writeFile(realFilePath, content, {
      encoding: "utf8",
    });

    return res.json({
      success: true,
      message: "File saved successfully",
      projectId,
      path: req.query.path,
    });
  } catch (error) {
    console.error("Save file error:", error.message);

    return res.status(400).json({
      success: false,
      message: error.message || "Failed to save project file",
    });
  }
});

app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  console.error("Request error:", error.message);

  // Use the error's status if it looks like a client error (4xx),
  // otherwise fall back to 500 so server failures are not misreported.
  const status =
    error.status && error.status >= 400 && error.status < 500
      ? error.status
      : 500;

  res.status(status).json({
    success: false,
    message: status < 500 ? (error.message || "Invalid request") : "Internal server error",
  });
});

app.listen(PORT, () => {
  console.log(
    `DevPilot backend running at http://localhost:${PORT}`
  );
});