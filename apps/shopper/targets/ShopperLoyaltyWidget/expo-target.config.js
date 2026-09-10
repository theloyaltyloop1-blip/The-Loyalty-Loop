/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: 'widget',
  name: 'ShopperLoyaltyWidget',
  displayName: 'Loyalty progress',
  bundleIdentifier: '.shopperwidget',
  deploymentTarget: '17.0',
  frameworks: ['SwiftUI', 'WidgetKit'],
  colors: { $widgetBackground: '#FFF9F0', $accent: '#EF7136' },
  entitlements: {
    'com.apple.security.application-groups': config.ios.entitlements['com.apple.security.application-groups'],
  },
})
