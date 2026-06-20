import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = new URL("../../", import.meta.url).pathname;

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(join(repoRoot, path), "utf8")) as T;
}

function readText(path: string) {
  return readFileSync(join(repoRoot, path), "utf8");
}

interface PackageJson {
  name: string;
  version: string;
  description: string;
  scripts: Record<string, string>;
  bin: Record<string, string>;
  files?: string[];
  repository?: { type: string; url: string };
  bugs?: { url: string };
  homepage?: string;
  publishConfig?: { access?: string };
}

describe("public package contract", () => {
  it("declares npm metadata for a presentable MCP server and CLI package", () => {
    const pkg = readJson<PackageJson>("package.json");

    expect(pkg.description).toMatch(/MCP server \+ human CLI/i);
    expect(pkg.bin).toEqual({
      "mcp-notion": "./dist/index.js",
      notion: "./dist/cli.js",
    });
    expect(pkg.repository).toEqual({
      type: "git",
      url: "git+https://github.com/ftaricano/mcp-notion.git",
    });
    expect(pkg.bugs?.url).toBe(
      "https://github.com/ftaricano/mcp-notion/issues",
    );
    expect(pkg.homepage).toBe("https://github.com/ftaricano/mcp-notion#readme");
    expect(pkg.publishConfig?.access).toBe("public");
  });

  it("runs real test targets instead of passWithNoTests fallbacks", () => {
    const pkg = readJson<PackageJson>("package.json");

    for (const [name, script] of Object.entries(pkg.scripts)) {
      expect(script, `${name} should not hide missing tests`).not.toContain(
        "--passWithNoTests",
      );
    }
  });

  it("ships safe environment and security documentation without placeholder secrets", () => {
    const envExample = readText(".env.example");
    const security = readText("SECURITY.md");
    const readme = readText("README.md");
    const license = readText("LICENSE");

    expect(envExample).toContain("NOTION_TOKEN=");
    expect(envExample).toContain("VALIDATE_TOKEN=true");
    expect(envExample).not.toMatch(/secret_[A-Za-z0-9]/);
    expect(security).toContain("Notion tokens");
    expect(security).toContain("security/advisories/new");
    expect(readme).toMatch(/OAuth/i);
    expect(readme).toMatch(/CLI/i);
    expect(license).toContain("MIT License");
  });

  it("produces a clean npm pack file list", () => {
    execFileSync("npm", ["run", "build", "--silent"], {
      cwd: repoRoot,
      stdio: "pipe",
    });
    const output = execFileSync(
      "npm",
      ["pack", "--dry-run", "--json", "--ignore-scripts"],
      {
        cwd: repoRoot,
        encoding: "utf8",
      },
    );
    const [{ files }] = JSON.parse(output) as Array<{
      files: Array<{ path: string }>;
    }>;
    const filePaths = files.map((file) => file.path).sort();

    expect(filePaths).toEqual([
      "LICENSE",
      "README.md",
      "SECURITY.md",
      "dist/app.d.ts",
      "dist/app.d.ts.map",
      "dist/app.js",
      "dist/app.js.map",
      "dist/cache/cacheManager.d.ts",
      "dist/cache/cacheManager.d.ts.map",
      "dist/cache/cacheManager.js",
      "dist/cache/cacheManager.js.map",
      "dist/cli-support.d.ts",
      "dist/cli-support.d.ts.map",
      "dist/cli-support.js",
      "dist/cli-support.js.map",
      "dist/cli.d.ts",
      "dist/cli.d.ts.map",
      "dist/cli.js",
      "dist/cli.js.map",
      "dist/config/configManager.d.ts",
      "dist/config/configManager.d.ts.map",
      "dist/config/configManager.js",
      "dist/config/configManager.js.map",
      "dist/index.d.ts",
      "dist/index.d.ts.map",
      "dist/index.js",
      "dist/index.js.map",
      "dist/security/rateLimiter.d.ts",
      "dist/security/rateLimiter.d.ts.map",
      "dist/security/rateLimiter.js",
      "dist/security/rateLimiter.js.map",
      "dist/security/runtimePolicy.d.ts",
      "dist/security/runtimePolicy.d.ts.map",
      "dist/security/runtimePolicy.js",
      "dist/security/runtimePolicy.js.map",
      "dist/security/tokenValidator.d.ts",
      "dist/security/tokenValidator.d.ts.map",
      "dist/security/tokenValidator.js",
      "dist/security/tokenValidator.js.map",
      "dist/tools/pages.d.ts",
      "dist/tools/pages.d.ts.map",
      "dist/tools/pages.js",
      "dist/tools/pages.js.map",
      "dist/utils/blocks.d.ts",
      "dist/utils/blocks.d.ts.map",
      "dist/utils/blocks.js",
      "dist/utils/blocks.js.map",
      "dist/utils/errorHandler.d.ts",
      "dist/utils/errorHandler.d.ts.map",
      "dist/utils/errorHandler.js",
      "dist/utils/errorHandler.js.map",
      "dist/utils/richText.d.ts",
      "dist/utils/richText.d.ts.map",
      "dist/utils/richText.js",
      "dist/utils/richText.js.map",
      "dist/utils/templates.d.ts",
      "dist/utils/templates.d.ts.map",
      "dist/utils/templates.js",
      "dist/utils/templates.js.map",
      "package.json",
    ]);
  });
});
