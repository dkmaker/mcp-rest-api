module.exports = {
  types: [
    // These types trigger version bumps and appear in changelog
    { type: 'feat', section: 'Features', hidden: false },
    { type: 'fix', section: 'Bug Fixes', hidden: false },
    { type: 'perf', section: 'Performance', hidden: false },
    { type: 'refactor', section: 'Code Refactoring', hidden: false },
    // These types appear in changelog but don't trigger version bumps alone
    { type: 'docs', section: 'Documentation', hidden: false },
    { type: 'chore', section: 'Maintenance', hidden: true },
    { type: 'style', section: 'Styling', hidden: true },
    { type: 'test', section: 'Testing', hidden: true },
    { type: 'ci', section: 'CI/CD', hidden: true },
    { type: 'build', section: 'Build System', hidden: true }
  ],
  releaseRules: [
    // Only these types trigger version bumps
    { type: 'feat', release: 'minor' },
    { type: 'fix', release: 'patch' },
    { type: 'perf', release: 'patch' },
    { type: 'refactor', release: 'patch' },
    // These types do NOT trigger version bumps
    { type: 'chore', release: false },
    { type: 'docs', release: false },
    { type: 'style', release: false },
    { type: 'test', release: false },
    { type: 'ci', release: false },
    { type: 'build', release: false }
  ]
};
