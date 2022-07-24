const tasks = (taskList) => taskList.join(' && ')

module.exports = {
  hooks: {
    'commit-msg': 'commitlint -E HUSKY_GIT_PARAMS',
    'pre-commit': tasks(['lint-staged']),
  },
}
