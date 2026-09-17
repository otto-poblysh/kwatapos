import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function Home() {
  const [status, setStatus] = useState('Loading...');

  // Minimal implementation to pass the test and fetch data
  useEffect(() => {
    fetch('http://127.0.0.1:8095/api/health')
      .then(res => res.json())
      .then(data => setStatus(data.message))
      .catch(err => setStatus('Backend Offline'));
  }, []);

  return (
    <View style={styles.container}>
      <Text>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7', alignItems: 'center', justifyContent: 'center' },
});
