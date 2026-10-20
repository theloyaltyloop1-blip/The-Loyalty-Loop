const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')
const fs = require('fs')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '../..')

const config = getDefaultConfig(projectRoot)

// Watch real dependency targets as well as the worktree (Windows junctions).
const dependencyRoots = [path.resolve(projectRoot, 'node_modules'), path.resolve(workspaceRoot, 'node_modules')]
  .filter(folder => fs.existsSync(folder)).map(folder => fs.realpathSync(folder))
config.watchFolders = [...new Set([workspaceRoot, ...dependencyRoots])]
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
]

// Shared loyalty logic lives in packages/loyalty. Aliased by path, not through
// node_modules, so no npm workspace change (and no lockfile change) is needed.
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  '@loyalty-loop/design-tokens': path.resolve(workspaceRoot, 'packages/design-tokens'),
  '@loyalty-loop/loyalty': path.resolve(workspaceRoot, 'packages/loyalty/src'),
}

module.exports = config
