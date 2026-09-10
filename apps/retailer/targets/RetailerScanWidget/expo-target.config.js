/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: 'widget',
  name: 'RetailerScanWidget',
  displayName: 'Open scanner',
  bundleIdentifier: '.retailerwidget',
  deploymentTarget: '17.0',
  frameworks: ['SwiftUI', 'WidgetKit'],
  colors: { $widgetBackground: '#1D211C', $accent: '#EF7136' },
  entitlements: {
    'com.apple.security.application-groups': config.ios.entitlements['com.apple.security.application-groups'],
  },
})
