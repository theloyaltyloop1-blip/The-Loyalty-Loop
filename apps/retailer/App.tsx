import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

export default function App() {
  return (
    <View style={styles.container}>
      <View style={styles.mark}><Text style={styles.markText}>↻</Text></View>
      <Text style={styles.eyebrow}>THE LOYALTY LOOP FOR BUSINESS</Text>
      <Text style={styles.title}>Your regulars,{"\n"}all in one place.</Text>
      <Text style={styles.copy}>The retailer app is being prepared. Soon you’ll be able to award rewards, manage your shop and keep track of what brings customers back.</Text>
      <StatusBar style="dark" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f3eb',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: 32,
  },
  mark: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#30442d',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  markText: { color: '#d9aa58', fontSize: 36, fontWeight: '700' },
  eyebrow: { color: '#bb622a', fontSize: 12, fontWeight: '700', letterSpacing: 1.3, marginBottom: 14 },
  title: { color: '#30442d', fontSize: 38, lineHeight: 46, fontWeight: '700', letterSpacing: -1.2 },
  copy: { color: '#5f665d', fontSize: 17, lineHeight: 26, marginTop: 20, maxWidth: 340 },
});
