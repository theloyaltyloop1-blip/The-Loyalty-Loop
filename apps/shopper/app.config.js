const app = require('./app.json')

const mapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY

module.exports = {
  ...app.expo,
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
}
