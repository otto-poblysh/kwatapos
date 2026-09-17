import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../core/hooks/useAuth';

export default function ManagerDashboard() {
  const { user, logout } = useAuth();
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>Manager Dashboard</Text>
          <Text style={styles.subtitle}>Requisitions & Inventory Oversight</Text>

          <View style={styles.infoBox}>
            <Text style={styles.infoLabel}>Active User:</Text>
            <Text style={styles.infoValue}>{user?.email ?? 'Unknown'}</Text>
          </View>

          <View style={styles.infoBox}>
            <Text style={styles.infoLabel}>Role:</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>{user?.role ?? 'manager'}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.manageButton}
            onPress={() => router.push('/(manager)/requisitions')}
            accessibilityRole="button"
            accessibilityLabel="Manage Requisitions"
            testID="manage-requisitions-btn"
          >
            <Text style={styles.manageButtonText}>Manage Requisitions</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.logoutButton}
            onPress={logout}
            accessibilityRole="button"
            accessibilityLabel="Log Out"
          >
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    padding: 24,
    width: '100%',
    maxWidth: 420,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#111111',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 24,
  },
  infoBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111111',
  },
  roleBadge: {
    backgroundColor: '#FFF3D6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  roleText: {
    color: '#1C1C1E',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  manageButton: {
    backgroundColor: '#000000',
    borderRadius: 9999,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginTop: 24,
  },
  manageButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  logoutButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 9999,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginTop: 12,
  },
  logoutText: {
    color: '#111111',
    fontSize: 15,
    fontWeight: '700',
  },
});
