module.exports = {
  types: [
    { type: 'feat', section: 'Features', hidden: false },
    { type: 'fix', section: 'Bug Fixes', hidden: false },
    { type: 'chore', section: 'Maintenance', hidden: false },
    { type: 'docs', section: 'Documentation', hidden: false },
    { type: 'style', section: 'Styling', hidden: false },
    { type: 'refactor', section: 'Code Refactoring', hidden: false },
    { type: 'perf', section: 'Performance', hidden: false },
    { type: 'test', section: 'Testing', hidden: false },
    { type: 'ci', section: 'CI/CD', hidden: false },
    { type: 'build', section: 'Build System', hidden: false }
  ],
  releaseRules: [
    { type: 'feat', release: 'minor' },
    { type: 'fix', release: 'patch' },
    { type: 'perf', release: 'patch' },
    { type: 'chore', release: 'patch' },
    { type: 'docs', release: 'patch' },
    { type: 'style', release: 'patch' },
    { type: 'refactor', release: 'patch' },
    { type: 'test', release: 'patch' },
    { type: 'ci', release: 'patch' },
    { type: 'build', release: 'patch' }
  ]
};
