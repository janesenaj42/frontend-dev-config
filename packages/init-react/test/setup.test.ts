import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SHARED_PACKAGE_RANGES } from "../src/constants.js";
import { stamp } from "../src/managed.js";
import { release } from "../src/release.js";
import { planSetup } from "../src/setup.js";
import { hasCommand, UserError } from "../src/util.js";
import {
  applySetup,
  makeRepo,
  read,
  readPackageJson,
  write,
} from "./helpers.js";

const FLAT = "@janesenaj42/eslint-config";
const LEGACY = "@janesenaj42/eslint-config-legacy";

function setEslint(project: string, range: string): string {
  const pkgPath = join(project, "package.json");
  const pkg = readPackageJson(pkgPath);
  pkg.devDependencies.eslint = range;
  write(pkgPath, JSON.stringify(pkg, null, 2));
  return pkgPath;
}

describe("setup on a Vite project inside a larger repository", () => {
  it("replaces Vite's ESLint default with the flat Standard", () => {
    const repo = makeRepo("vite8", { relDir: "frontend" });
    write(join(repo.project, "package-lock.json"), "{}\n");
    applySetup(repo.project);

    const pkg = readPackageJson(join(repo.project, "package.json"));
    expect(read(join(repo.project, "eslint.config.js"))).toContain(FLAT);
    expect(pkg.devDependencies["eslint-plugin-react-hooks"]).toBeUndefined();
    // Vite's ESLint 9 stays; @eslint/js follows its major.
    expect(pkg.devDependencies.eslint).toBe("^9.39.1");
    expect(pkg.devDependencies["@eslint/js"]).toBe("^9.39.1");
    expect(pkg.devDependencies[FLAT]).toBe(SHARED_PACKAGE_RANGES[FLAT]);
    expect(pkg.scripts.lint).toBe("eslint .");
    expect(pkg.scripts.typecheck).toBe("tsc -b");
    expect(pkg["init-react"]).toEqual({
      releaseBranch: "main",
      tagPrefix: "frontend@",
    });
    expect(read(join(repo.project, ".npmrc"))).toContain(
      "@janesenaj42:registry=https://npm.pkg.github.com",
    );

    const readme = read(join(repo.project, "README.md"));
    expect(readme).toContain("<!-- >>> init-react >>> -->");
    expect(readme).toMatch(/\| `npm run lint` +\| Lint with ESLint +\|/);

    // Git hooks and commit rules belong to repo-setup; CI to the CI team.
    expect(pkg.scripts.prepare).toBeUndefined();
    expect(pkg["lint-staged"]).toBeUndefined();
    expect(existsSync(join(repo.root, "lefthook.yml"))).toBe(false);
    expect(existsSync(join(repo.project, "commitlint.config.js"))).toBe(false);
    expect(existsSync(join(repo.root, ".github"))).toBe(false);
  });

  it("changes nothing when run again", () => {
    const repo = makeRepo("vite8", { relDir: "frontend" });
    applySetup(repo.project);
    const again = planSetup(repo.project, { dryRun: true, force: new Set() });
    expect(again.hasChanges).toBe(false);
  });

  it("gives a project without ESLint ESLint 10 and the flat Standard", () => {
    const repo = makeRepo("vite9");
    applySetup(repo.project);
    const pkg = readPackageJson(join(repo.project, "package.json"));
    expect(existsSync(join(repo.project, ".oxlintrc.json"))).toBe(false);
    expect(pkg.devDependencies.oxlint).toBeUndefined();
    expect(pkg.devDependencies.eslint).toBe("^10.0.0");
    expect(pkg.devDependencies["@eslint/js"]).toBe("^10.0.0");
    expect(pkg.scripts.lint).toBe("eslint .");
    expect(pkg["init-react"].tagPrefix).toBe("v");
  });
});

describe("Prettier", () => {
  it("uses Prettier's defaults: no config file, but the scripts and ignore file", () => {
    const repo = makeRepo("vite8");
    applySetup(repo.project);
    const pkg = readPackageJson(join(repo.project, "package.json"));
    expect(existsSync(join(repo.project, "prettier.config.js"))).toBe(false);
    expect(pkg.prettier).toBeUndefined();
    expect(pkg.devDependencies.prettier).toBeDefined();
    expect(pkg.scripts["format:check"]).toBe("prettier --check .");
    expect(read(join(repo.project, ".prettierignore"))).toContain(
      "CHANGELOG.md",
    );
  });

  it("removes an unedited config an earlier release wrote, and keeps the project's own unless forced", () => {
    const repo = makeRepo("vite8");
    const managed = join(repo.project, "prettier.config.js");
    write(managed, stamp("export default {};\n", "//"));
    const own = join(repo.project, ".prettierrc.json");
    write(own, '{ "printWidth": 120 }\n');
    applySetup(repo.project);
    expect(existsSync(managed)).toBe(false);
    expect(read(own)).toBe('{ "printWidth": 120 }\n');
    applySetup(repo.project, { force: ["prettier"] });
    expect(existsSync(own)).toBe(false);
  });
});

describe("Existing Config", () => {
  it("keeps an edited config and a custom script unless forced", () => {
    const repo = makeRepo("vite8");
    const eslintPath = join(repo.project, "eslint.config.js");
    write(eslintPath, read(eslintPath) + "// team tweak\n");
    const pkgPath = join(repo.project, "package.json");
    const pkg = readPackageJson(pkgPath);
    pkg.scripts.format = "prettier --write src";
    write(pkgPath, JSON.stringify(pkg, null, 2));

    applySetup(repo.project);
    expect(read(eslintPath)).toContain("// team tweak");
    expect(readPackageJson(pkgPath).scripts.format).toBe(
      "prettier --write src",
    );

    applySetup(repo.project, { force: ["eslint"] });
    expect(read(eslintPath)).toContain(FLAT);
    expect(readPackageJson(pkgPath).scripts.format).toBe(
      "prettier --write src",
    );
  });

  it("updates an unedited Managed File written by an older release", () => {
    const repo = makeRepo("vite8");
    const eslintPath = join(repo.project, "eslint.config.js");
    write(eslintPath, stamp("export default [];\n", "//"));
    applySetup(repo.project);
    expect(read(eslintPath)).toContain(FLAT);
  });

  it("keeps a Managed File someone has edited", () => {
    const repo = makeRepo("vite8");
    const eslintPath = join(repo.project, "eslint.config.js");
    write(
      eslintPath,
      stamp("export default [];\n", "//").replace("[]", "[{}]"),
    );
    applySetup(repo.project);
    expect(read(eslintPath)).toContain("[{}]");
  });
});

describe("a project on ESLint 8 (legacy Standard)", () => {
  const OWN_CONFIG = '{ "root": true, "extends": ["airbnb"] }\n';

  it("gets the legacy Standard in .eslintrc.json, keeping ESLint 8", () => {
    const repo = makeRepo("vite8");
    const pkgPath = setEslint(repo.project, "^8.57.1");
    const plan = applySetup(repo.project);

    const pkg = readPackageJson(pkgPath);
    expect(read(join(repo.project, ".eslintrc.json"))).toContain(LEGACY);
    // Vite's flat config can't load in ESLint 8, so the unedited scaffold is replaced.
    expect(existsSync(join(repo.project, "eslint.config.js"))).toBe(false);
    expect(pkg.devDependencies.eslint).toBe("^8.57.1");
    expect(pkg.devDependencies[LEGACY]).toBe(SHARED_PACKAGE_RANGES[LEGACY]);
    expect(pkg.devDependencies[FLAT]).toBeUndefined();
    expect(pkg.scripts.lint).toBe("eslint --ext .js,.jsx,.ts,.tsx .");
    expect(
      plan.entries.some(
        (e) => e.kind === "note" && e.text.includes("To move to flat config"),
      ),
    ).toBe(true);
  });

  it("keeps the project's own .eslintrc and says how to add the Standard", () => {
    const repo = makeRepo("vite8");
    const pkgPath = setEslint(repo.project, "^8.57.1");
    write(join(repo.project, ".eslintrc.json"), OWN_CONFIG);
    const plan = applySetup(repo.project);

    expect(read(join(repo.project, ".eslintrc.json"))).toBe(OWN_CONFIG);
    expect(readPackageJson(pkgPath).devDependencies[LEGACY]).toBeUndefined();
    expect(
      plan.entries.some(
        (e) => e.kind === "keep" && e.text.includes(`Put "${LEGACY}" first`),
      ),
    ).toBe(true);
  });

  it("replaces the project's own .eslintrc with --force=eslint", () => {
    const repo = makeRepo("vite8");
    setEslint(repo.project, "^8.57.1");
    write(join(repo.project, ".eslintrc.json"), OWN_CONFIG);
    applySetup(repo.project, { force: ["eslint"] });
    expect(read(join(repo.project, ".eslintrc.json"))).toContain(LEGACY);
  });

  it("moves to the flat Standard once ESLint is upgraded and forced", () => {
    const repo = makeRepo("vite8");
    const pkgPath = setEslint(repo.project, "^8.57.1");
    applySetup(repo.project);
    setEslint(repo.project, "^10.0.0");
    applySetup(repo.project, { force: ["eslint"] });

    const pkg = readPackageJson(pkgPath);
    expect(existsSync(join(repo.project, ".eslintrc.json"))).toBe(false);
    expect(read(join(repo.project, "eslint.config.js"))).toContain(FLAT);
    expect(pkg.devDependencies[FLAT]).toBe(SHARED_PACKAGE_RANGES[FLAT]);
  });
});

describe("a project keeping its own flat config", () => {
  it("only notes that its config is kept", () => {
    const repo = makeRepo("vite8");
    setEslint(repo.project, "^10.1.0");
    write(join(repo.project, "eslint.config.js"), "export default [];\n");
    const plan = applySetup(repo.project);
    expect(plan.entries.some((e) => e.kind === "warn")).toBe(false);
    expect(
      plan.entries.some(
        (e) => e.kind === "note" && e.text.includes("your own config is kept"),
      ),
    ).toBe(true);
  });
});

describe("Scripts docs", () => {
  it("adds its block to an existing README without touching the rest", () => {
    const repo = makeRepo("vite8");
    write(
      join(repo.project, "README.md"),
      "# My App\n\nSome docs the team wrote.\n",
    );
    applySetup(repo.project);
    const readme = read(join(repo.project, "README.md"));
    expect(readme).toContain("# My App\n\nSome docs the team wrote.");
    expect(readme).toContain("<!-- >>> init-react >>> -->");
  });

  it("overwrites its own block", () => {
    const repo = makeRepo("vite8");
    applySetup(repo.project);
    const path = join(repo.project, "README.md");
    write(path, read(path).replace("Lint with ESLint", "Lint with ESLint!!"));
    applySetup(repo.project);
    expect(read(path)).not.toContain("Lint with ESLint!!");
    expect(read(path)).toContain("Lint with ESLint");
  });

  it("writes the block as Prettier formats it, so format:check passes", async () => {
    const { format } = await import("prettier");
    const repo = makeRepo("vite8");
    write(join(repo.project, "README.md"), "# My App\n");
    applySetup(repo.project);
    const readme = read(join(repo.project, "README.md"));
    expect(await format(readme, { parser: "markdown" })).toBe(readme);
  });

  it("uses pnpm for a new project when pnpm is installed, npm otherwise", () => {
    const repo = makeRepo("vite8");
    applySetup(repo.project);
    const pm = hasCommand("pnpm", repo.project) ? "pnpm lint" : "npm run lint";
    expect(read(join(repo.project, "README.md"))).toContain(`| \`${pm}\``);
  });

  it("uses the project's package manager to run scripts", () => {
    const repo = makeRepo("vite8");
    write(join(repo.project, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
    applySetup(repo.project);
    expect(read(join(repo.project, "README.md"))).toMatch(
      /\| `pnpm lint` +\| Lint with ESLint +\|/,
    );
  });

  it("uses CONTRIBUTING.md when the project has one, and leaves README.md alone", () => {
    const repo = makeRepo("vite8");
    write(join(repo.project, "README.md"), "# My App\n");
    write(
      join(repo.project, "CONTRIBUTING.md"),
      "# Contributing\n\nSome docs the team wrote.\n",
    );
    applySetup(repo.project);
    expect(read(join(repo.project, "README.md"))).toBe("# My App\n");
    const contributing = read(join(repo.project, "CONTRIBUTING.md"));
    expect(contributing).toContain(
      "# Contributing\n\nSome docs the team wrote.",
    );
    expect(contributing).toContain("<!-- >>> init-react >>> -->");
  });

  it("moves the block out of README.md once CONTRIBUTING.md exists", async () => {
    const { format } = await import("prettier");
    const repo = makeRepo("vite8");
    const path = join(repo.project, "README.md");
    write(path, "# My App\n\n## After\n");
    applySetup(repo.project);
    expect(read(path)).toContain("<!-- >>> init-react >>> -->");
    write(join(repo.project, "CONTRIBUTING.md"), "# Contributing\n");
    applySetup(repo.project);
    const readme = read(path);
    expect(readme).toBe("# My App\n\n## After\n");
    expect(await format(readme, { parser: "markdown" })).toBe(readme);
    expect(read(join(repo.project, "CONTRIBUTING.md"))).toContain(
      "<!-- >>> init-react >>> -->",
    );
  });
});

describe("Release guards", () => {
  it("refuses a full Release off the Release Branch", () => {
    const repo = makeRepo("vite8");
    applySetup(repo.project, { releaseBranch: "dev" });
    repo.git("add", "-A");
    repo.git("-c", "core.hooksPath=/dev/null", "commit", "-qm", "chore: init");
    expect(() => release("patch", repo.project)).toThrow(UserError);
    expect(() => release("patch", repo.project)).toThrow(
      /Release Branch "dev"/,
    );
  });

  it("refuses to release with uncommitted changes", () => {
    const repo = makeRepo("vite8");
    applySetup(repo.project);
    repo.git("add", "-A");
    repo.git("-c", "core.hooksPath=/dev/null", "commit", "-qm", "chore: init");
    write(join(repo.project, "dirty.txt"), "x");
    expect(() => release("rc", repo.project)).toThrow(/uncommitted/);
  });

  it("rejects unknown release types", () => {
    expect(() => release("hotfix", ".")).toThrow(/Unknown release type/);
  });
});

describe("--skip", () => {
  it("leaves Prettier to the repository, and remembers it", () => {
    const repo = makeRepo("vite8", { relDir: "web" });
    applySetup(repo.project, { skip: ["prettier"] });

    const pkg = readPackageJson(join(repo.project, "package.json"));
    expect(pkg["init-react"]).toEqual({
      skip: ["prettier"],
      releaseBranch: "main",
      tagPrefix: "web@",
    });
    expect(pkg.scripts.format).toBeUndefined();
    const again = planSetup(repo.project, { dryRun: true, force: new Set() });
    expect(again.hasChanges).toBe(false);
  });

  it("is cleared with an empty list (--skip=none)", () => {
    const repo = makeRepo("vite8");
    applySetup(repo.project, { skip: ["prettier"] });
    applySetup(repo.project, { skip: [] });
    const pkg = readPackageJson(join(repo.project, "package.json"));
    expect(pkg["init-react"].skip).toBeUndefined();
    expect(pkg.scripts.format).toBe("prettier --write .");
  });
});

describe("--registry", () => {
  const MIRROR = "https://nexus.acme.internal/repository/npm-group";

  it("installs from a mirror", () => {
    const repo = makeRepo("vite8", { relDir: "web" });
    applySetup(repo.project, { registry: `${MIRROR}/` });

    const pkg = readPackageJson(join(repo.project, "package.json"));
    expect(pkg["init-react"].registry).toBe(MIRROR);
    expect(read(join(repo.project, ".npmrc"))).toContain(
      `@janesenaj42:registry=${MIRROR}`,
    );
    const again = planSetup(repo.project, { dryRun: true, force: new Set() });
    expect(again.hasChanges).toBe(false);
  });

  it("takes the registry from the project's own .npmrc", () => {
    const repo = makeRepo("vite8");
    write(
      join(repo.project, ".npmrc"),
      `@janesenaj42:registry=${MIRROR}\n`,
    );
    applySetup(repo.project);
    const pkg = readPackageJson(join(repo.project, "package.json"));
    expect(pkg["init-react"].registry).toBe(MIRROR);
  });

  it("rejects something that isn't a URL", () => {
    const repo = makeRepo("vite8");
    expect(() =>
      planSetup(repo.project, {
        dryRun: true,
        force: new Set(),
        registry: "nexus",
      }),
    ).toThrow(UserError);
  });
});
