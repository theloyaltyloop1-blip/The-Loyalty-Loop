import { registerRootComponent } from 'expo';
import { Platform } from 'react-native'

import App from './App';

if (Platform.OS === 'android') {
  const { registerWidgetTaskHandler } = require('react-native-android-widget') as typeof import('react-native-android-widget')
  const { shopperWidgetTask } = require('./src/widgets/android-task') as typeof import('./src/widgets/android-task')
  registerWidgetTaskHandler(shopperWidgetTask)
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
