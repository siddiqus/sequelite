module.exports = {
  '*.{ts}': () => 'tsc -p tsconfig.json --noEmit',
  '*.{ts}': ['eslint'],
}
