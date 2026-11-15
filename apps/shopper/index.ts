// Must stay first: patches StyleSheet.create before any screen defines styles.
import './src/smooth-corners';
import { registerRootComponent } from 'expo';
import { Platform } from 'react-native'

import App from './App';
import { defineWalkPastTask } from './src/walk-past';

// The OS can wake the app for a walk-past geofence with no UI, so the task is defined before React starts.
defineWalkPastTask()

if (Platform.OS === 'android') {
  const { registerWidgetTaskHandler } = require('react-native-android-widget') as typeof import('react-native-android-widget')
  const { shopperWidgetTask } = require('./src/widgets/android-task') as typeof import('./src/widgets/android-task')
  registerWidgetTaskHandler(shopperWidgetTask)
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
