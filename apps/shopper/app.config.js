const app = require('./app.json')

const mapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
const mapsApiKeyIos = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_IOS

module.exports = {
  ...app.expo,
  ios: {
    ...app.expo.ios,
    appleTeamId: '9QSSA475TR',
    infoPlist: {
      ...app.expo.ios.infoPlist,
      // react-native-maps links CoreLocation even though the app never asks
      // for location; App Store Connect warns (ITMS-90683) without this.
      NSLocationWhenInUseUsageDescription: 'The Loyalty Loop does not track your location. This is required by the maps component used to show shop pins.',
    },
    entitlements: {
      ...app.expo.ios.entitlements,
      'com.apple.security.application-groups': ['group.com.theloyaltyloop.shopper'],
    },
    config: {
      ...app.expo.ios.config,
      googleMapsApiKey: mapsApiKeyIos || undefined,
    },
  },
  android: {
    ...app.expo.android,
    config: {
      ...app.expo.android.config,
      googleMaps: mapsApiKey ? { apiKey: mapsApiKey } : undefined,
    },
  },
  updates: {
    url: 'https://u.expo.dev/474f40e3-c739-4317-8a94-12a73795ef04',
  },
  runtimeVersion: {
    policy: 'appVersion',
  },
  plugins: [
    ...(app.expo.plugins || []),
    'expo-sqlite',
    '@bacons/apple-targets',
    [
      'react-native-android-widget',
      {
        widgets: [
          {
            name: 'ShopperLoyaltyWidget',
            label: 'Loyalty progress',
            description: 'See the next reward at a glance and open your customer card.',
            minWidth: '250dp',
            minHeight: '140dp',
            targetCellWidth: 4,
            targetCellHeight: 2,
            updatePeriodMillis: 1800000,
          },
        ],
      },
    ],
  ],
}
