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

// Code analysis limits.
const MAX_ANALYSIS_FILES = 300;
const MAX_ANALYSIS_FILE_SIZE = 1024 * 1024;
const MAX_ANALYSIS_TOTAL_SIZE = 10 * 1024 * 1024;

const ANALYZABLE_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
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

// Validate a relative path supplied by the client.
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

// Ensure a resolved path stays inside its root directory.
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

// Analyze JavaScript source using lightweight heuristics.
// This function never executes uploaded code.
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

// Run ESLint against source text without executing uploaded code.
async function analyzeWithESLint(content, relativePath) {
  const eslint = new ESLint({
    cwd: __dirname,
    overrideConfigFile: path.join(__dirname, "eslint.config.js"),
  });

  const results = await eslint.lintText(content, {
    filePath: path.resolve(__dirname, relativePath),
  });

    console.log(
    "[ESLint Config Test]",
    JSON.stringify(
      {
        filePath: path.resolve(__dirname, relativePath),
        results: results.map((result) => ({
          warningCount: result.warningCount,
          errorCount: result.errorCount,
          messages: result.messages.map((message) => ({
            rule: message.ruleId,
            severity: message.severity,
            message: message.message,
          })),
        })),
      },
      null,
      2
    )
  );

  
  const findings = [];

  for (const result of results) {
    for (const message of result.messages) {
      // Ignore parser errors here; report them through the existing
      // analysis error mechanism in a later integration step.
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

// Scan uploaded project files without executing them.
async function analyzeProjectFiles(projectRoot) {
  const findings = [];
  const errors = [];
  const scannedFiles = [];

  let filesSkipped = 0;
  let totalBytesScanned = 0;
  let fileLimitReached = false;

  const rootStat = await fs.promises.lstat(projectRoot);

  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    throw new Error("Invalid project directory");
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
        continue;
      }

      const absolutePath = path.join(directory, entry.name);

      const relativePath = path
        .relative(projectRoot, absolutePath)
        .split(path.sep)
        .join("/");

      if (entry.isSymbolicLink()) {
        filesSkipped++;
        continue;
      }

      if (entry.isDirectory()) {
        if (IGNORED_DIRECTORIES.has(entry.name)) {
          filesSkipped++;
          continue;
        }

        await walk(absolutePath);
        continue;
      }

      if (!entry.isFile()) {
        filesSkipped++;
        continue;
      }

      const extension = path.extname(entry.name).toLowerCase();

      if (!ANALYZABLE_EXTENSIONS.has(extension)) {
        filesSkipped++;
        continue;
      }

      try {
        const realFilePath = await fs.promises.realpath(absolutePath);

        ensureInsideRoot(projectRoot, realFilePath);

        const stat = await fs.promises.lstat(realFilePath);

        if (!stat.isFile() || stat.isSymbolicLink()) {
          filesSkipped++;
          continue;
        }

        if (stat.size > MAX_ANALYSIS_FILE_SIZE) {
          filesSkipped++;

          errors.push({
            path: relativePath,
            message: "File exceeds the 1 MB analysis limit.",
          });

          continue;
        }

        if (
          totalBytesScanned + stat.size >
          MAX_ANALYSIS_TOTAL_SIZE
        ) {
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

        findings.push(
          ...analyzeJavaScript(content, relativePath)
        );

                try {
          
          const eslintFindings = await analyzeWithESLint(
            content,
            relativePath
          );

          findings.push(...eslintFindings);

          console.log(
            `[ESLint] ${relativePath}: ${eslintFindings.length} findings`
          );
        
        } catch (eslintError) {
          console.error(
            `[ESLint Error] ${relativePath}:`,
            eslintError
          );

          errors.push({
            path: relativePath,
            message: `ESLint analysis failed: ${
              eslintError.message || "Unknown ESLint error"
            }`,
          });
        }
      } catch (fileError) {
        errors.push({
          path: relativePath,
          message: `Unable to analyze file: ${
            fileError.message || "Unknown file error"
          }`,
        });
      }
    }

    }

    await walk(projectRoot);

    return {
    filesScanned: scannedFiles.length,
    filesSkipped,
    totalBytesScanned,
    fileLimitReached,
    scannedFiles,
    findings,
    errors,
  };
}
// Safely extract a ZIP archive.
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
        } catch {}
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

// Retrieve a project only when it has an uploaded directory
// inside the permitted project storage directory.
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
// Root endpoint.
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Welcome to DevPilot API",
  });
});

// Backend health check.
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "DevPilot backend is running",
    status: "healthy",
  });
});

// Database health check.
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

// Get all projects.
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

// Create a project.
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
// Upload and extract a ZIP for an existing project.
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

      // Remove the previous upload only after the new upload succeeds.
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

// Analyze an uploaded project.
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
// List files and directories in an uploaded project.
app.get("/api/projects/:id/files", async (req, res) => {
  try {
    const projectId = Number(req.params.id);
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

// Read a file from an uploaded project.
app.get("/api/projects/:id/file", async (req, res) => {
  try {
    const projectId = Number(req.params.id);
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

// Save edited file content to an uploaded project.
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
      message: error.message || "Failed to save file",
    });
  }
});

// Handle unexpected errors.
app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  console.error("Request error:", error.message);

  res.status(400).json({
    success: false,
    message: "Invalid request",
  });
});

// Start backend server.
app.listen(PORT, () => {
  console.log(
    `DevPilot backend running at http://localhost:${PORT}`
  );
});
