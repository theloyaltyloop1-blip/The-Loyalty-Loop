import { useRef, useState } from 'react'
import { ActivityIndicator, BackHandler, Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { WebView } from 'react-native-webview'

const adminUrl = 'https://www.the-loyalty-loop.com/access'

function AdminPanel() {
  const webView = useRef<WebView>(null)
  const [loading, setLoading] = useState(true)
  const [canGoBack, setCanGoBack] = useState(false)

  return <SafeAreaView style={styles.safe} edges={['top']}>
    <StatusBar style="dark" />
    <View style={styles.header}>
      <Text style={styles.title}>Admin dashboard</Text>
      <Pressable onPress={() => webView.current?.reload()} style={styles.refresh}><Text style={styles.refreshText}>Refresh</Text></Pressable>
    </View>
    <WebView
      ref={webView}
      source={{ uri: adminUrl }}
      onLoadStart={() => setLoading(true)}
      onLoadEnd={() => setLoading(false)}
      onNavigationStateChange={(state) => setCanGoBack(state.canGoBack)}
      onShouldStartLoadWithRequest={(request) => request.url.startsWith('https://www.the-loyalty-loop.com/')}
      setSupportMultipleWindows={false}
      thirdPartyCookiesEnabled
      sharedCookiesEnabled
    />
    {loading && <View style={styles.loading}><ActivityIndicator size="large" color="#2563eb" /><Text style={styles.loadingText}>Loading admin dashboard…</Text></View>}
    {canGoBack && <Pressable style={styles.back} onPress={() => webView.current?.goBack()}><Text style={styles.backText}>Back</Text></Pressable>}
  </SafeAreaView>
}

export default function App() {
  return <SafeAreaProvider><AdminPanel /></SafeAreaProvider>
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f7fb' },
  header: { height: 70, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  title: { fontSize: 20, fontWeight: '800', letterSpacing: -0.4, color: '#172033' },
  refresh: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9 },
  refreshText: { color: '#172033', fontWeight: '700', fontSize: 13 },
  loading: { ...StyleSheet.absoluteFillObject, top: 70, backgroundColor: '#f5f7fb', alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: '#526176', fontSize: 14, fontWeight: '700' },
  back: { position: 'absolute', right: 18, bottom: 18, borderRadius: 999, backgroundColor: '#2563eb', paddingHorizontal: 18, paddingVertical: 11 },
  backText: { color: '#fff', fontSize: 13, fontWeight: '700' },
})
