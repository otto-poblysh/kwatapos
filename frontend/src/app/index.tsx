import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform, ActivityIndicator } from 'react-native';

interface HealthData {
  status: string;
  message: string;
  database: string;
  sample_data?: string | null;
}

export default function Home() {
  const [data, setData] = useState<HealthData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const apiUrl = Platform.OS === 'android' 
    ? 'http://10.0.2.2:8095/api/health' 
    : 'http://127.0.0.1:8095/api/health';

  useEffect(() => {
    fetch(apiUrl)
      .then(res => res.json())
      .then((json: HealthData) => setData(json))
      .catch((err) => setError('Backend Offline'));
  }, [apiUrl]);

  if (!data && !error) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Kwata POS</Text>
        <Text style={styles.subtitle}>Phase 1 Foundation & Scaffolding</Text>

        <View style={styles.divider} />

        <View style={styles.row}>
          <Text style={styles.label}>Backend Status:</Text>
          <View style={[styles.badge, error ? styles.badgeError : styles.badgeSuccess]}>
            <Text style={styles.badgeText}>{error ? error : data?.message}</Text>
          </View>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>PostgreSQL DB:</Text>
          <View style={[styles.badge, data?.database === 'connected' ? styles.badgeSuccess : styles.badgeWarning]}>
            <Text style={styles.badgeText}>{data?.database ?? 'Not connected'}</Text>
          </View>
        </View>

        {data?.sample_data && (
          <View style={styles.sampleBox}>
            <Text style={styles.sampleLabel}>DB Sample Payload:</Text>
            <Text style={styles.sampleText}>"{data.sample_data}"</Text>
          </View>
        )}

        <View style={styles.metaBox}>
          <Text style={styles.metaText}>API: {apiUrl}</Text>
          <Text style={styles.metaText}>Platform: {Platform.OS.toUpperCase()}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#8E8E93',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 420,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1C1C1E',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E5EA',
    marginVertical: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 8,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#3A3A3C',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeSuccess: {
    backgroundColor: '#E4F9E8',
  },
  badgeError: {
    backgroundColor: '#FDE8E8',
  },
  badgeWarning: {
    backgroundColor: '#FFF3D6',
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  sampleBox: {
    backgroundColor: '#F9F9FB',
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  sampleLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#636366',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  sampleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
    fontStyle: 'italic',
  },
  metaBox: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
  },
  metaText: {
    fontSize: 11,
    color: '#AEAEB2',
    textAlign: 'center',
    marginVertical: 1,
  },
});
