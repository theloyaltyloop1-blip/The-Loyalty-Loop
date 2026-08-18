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
      <View><Text style={styles.kicker}>THE LOYALTY LOOP</Text><Text style={styles.title}>Admin</Text></View>
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
    {loading && <View style={styles.loading}><ActivityIndicator size="large" color="#4F6438" /><Text style={styles.loadingText}>Loading Access Panel…</Text></View>}
    {canGoBack && <Pressable style={styles.back} onPress={() => webView.current?.goBack()}><Text style={styles.backText}>Back</Text></Pressable>}
  </SafeAreaView>
}

export default function App() {
  return <SafeAreaProvider><AdminPanel /></SafeAreaProvider>
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#171412' },
  header: { height: 70, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.12)' },
  kicker: { fontSize: 10, fontWeight: '800', letterSpacing: 1.4, color: '#C77A42' },
  title: { marginTop: 2, fontSize: 20, fontWeight: '900', color: '#FCF8F0' },
  refresh: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9 },
  refreshText: { color: '#FCF8F0', fontWeight: '800', fontSize: 13 },
  loading: { ...StyleSheet.absoluteFillObject, top: 70, backgroundColor: '#171412', alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: 'rgba(252,248,240,0.6)', fontSize: 14, fontWeight: '700' },
  back: { position: 'absolute', right: 18, bottom: 18, borderRadius: 999, backgroundColor: '#4F6438', paddingHorizontal: 18, paddingVertical: 11 },
  backText: { color: '#fff', fontSize: 13, fontWeight: '900' },
})
