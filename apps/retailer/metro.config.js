const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '../..')

const config = getDefaultConfig(projectRoot)

config.watchFolders = [workspaceRoot]
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
]

// Shared loyalty logic lives in packages/loyalty. Aliased by path, not through
// node_modules, so no npm workspace change (and no lockfile change) is needed.
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  '@loyalty-loop/loyalty': path.resolve(workspaceRoot, 'packages/loyalty/src'),
}

module.exports = config
