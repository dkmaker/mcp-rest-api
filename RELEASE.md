# Release Process

This document explains how releases work for the MCP REST API project.

## Overview

We use [Release Please](https://github.com/googleapis/release-please) by Google to manage releases. This gives us:

- **Controlled releases**: You decide when to release by merging a PR
- **Automatic changelogs**: Generated from conventional commit messages
- **Semantic versioning**: Version bumps based on commit types
- **No accidental releases**: Commits to main don't automatically publish

## How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                        Release Flow                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   1. Merge feature/fix PRs to main (normal development)         │
│                         │                                       │
│                         ▼                                       │
│   2. Release Please automatically creates/updates a             │
│      "Release PR" with changelog and version bump               │
│                         │                                       │
│                         ▼                                       │
│   3. The Release PR stays open, accumulating changes            │
│      (you can merge more features, it updates automatically)    │
│                         │                                       │
│                         ▼                                       │
│   4. When YOU'RE READY: merge the Release PR                    │
│                         │                                       │
│                         ▼                                       │
│   5. GitHub Release is created automatically                    │
│                         │                                       │
│                         ▼                                       │
│   6. NPM package is published automatically                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## For Contributors

### Writing Commits

We use [Conventional Commits](https://www.conventionalcommits.org/). Your commit messages determine version bumps:

| Commit Type | Version Bump | Example |
|-------------|--------------|---------|
| `feat:` | Minor (0.4.0 → 0.5.0) | `feat: add file upload support` |
| `fix:` | Patch (0.4.0 → 0.4.1) | `fix: handle empty response body` |
| `perf:` | Patch | `perf: optimize large response handling` |
| `refactor:` | Patch | `refactor: simplify auth logic` |
| `BREAKING CHANGE:` | Major (0.4.0 → 1.0.0) | Footer in commit body |

These commit types are tracked but **don't trigger version bumps**:
- `docs:` - Documentation changes
- `test:` - Adding or updating tests
- `ci:` - CI/CD configuration
- `build:` - Build system changes
- `chore:` - Maintenance tasks
- `style:` - Code formatting

### Example Workflow

```bash
# 1. Create a feature branch
git checkout -b feat/new-feature

# 2. Make changes and commit with conventional format
git commit -m "feat: add support for custom timeout"

# 3. Push and create PR
git push -u origin feat/new-feature
gh pr create

# 4. After PR is merged to main, Release Please updates the Release PR
# 5. Maintainer merges Release PR when ready to publish
```

## For Maintainers

### Releasing a New Version

1. **Check the Release PR**: Look for a PR titled "chore(main): release X.Y.Z"
2. **Review the changelog**: Ensure it accurately reflects the changes
3. **Merge when ready**: Merging triggers the release

That's it! The automation handles:
- Creating the GitHub release
- Publishing to NPM
- Updating the changelog

### What If There's No Release PR?

If no Release PR exists, it means there are no releasable changes since the last release. Only `feat:`, `fix:`, `perf:`, and `refactor:` commits trigger release PRs.

### Manual Release (Emergency)

If you need to release manually (not recommended):

```bash
# Update version
npm version patch  # or minor/major

# Push with tags
git push --follow-tags

# Create GitHub release manually
gh release create v0.4.1 --generate-notes

# NPM publish will trigger automatically on release
```

## Configuration Files

| File | Purpose |
|------|---------|
| `release-please-config.json` | Release Please settings |
| `.release-please-manifest.json` | Current version tracker |
| `.github/workflows/release-please.yml` | Creates/updates Release PR |
| `.github/workflows/npm-publish.yml` | Publishes to NPM on release |
| `.github/conventional-changelog.config.cjs` | Changelog formatting |
| `commitlint.config.js` | Commit message validation |

## Version Numbering

We follow [Semantic Versioning](https://semver.org/):

```
MAJOR.MINOR.PATCH
  │     │     │
  │     │     └── Bug fixes, performance improvements
  │     └──────── New features (backwards compatible)
  └────────────── Breaking changes
```

While in 0.x.x (pre-1.0), minor versions may include breaking changes.

## FAQ

### Why not release on every commit?

Batching changes into deliberate releases:
- Gives users predictable update cycles
- Allows grouping related features
- Provides meaningful changelogs
- Reduces notification fatigue

### Can I release multiple times a day?

Yes! Merge the Release PR whenever you want. A new Release PR will be created after the next releasable commit.

### What if I need to fix a release?

1. Create a fix PR with `fix:` commit
2. Merge to main
3. Release Please updates the Release PR
4. Merge the Release PR to publish the fix

### How do I do a breaking change?

Add `BREAKING CHANGE:` in the commit footer:

```
feat: change API response format

BREAKING CHANGE: Response structure changed from array to object.
Users must update their code to handle the new format.
```

This will trigger a major version bump (0.x → 1.0 or 1.x → 2.0).
