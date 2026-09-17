import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { getApiBaseUrl, useAuth } from '../../core/hooks/useAuth';

interface AdminCustomer {
  id: string;
  name: string;
  phone_number: string;
  outstanding_balance: string | number;
}

async function parseError(res: Response, fallback: string): Promise<string> {
  const data = await res.json().catch(() => null);
  return data?.error || `${fallback} (${res.status})`;
}

function formatFcfa(value: string | number | undefined): string {
  const num = typeof value === 'number' ? value : Number(value ?? 0);
  return `${(Number.isNaN(num) ? 0 : num).toLocaleString()} FCFA`;
}

export default function AdminCustomersScreen() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');

  const headers = useCallback(
    () => ({
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    }),
    [accessToken]
  );

  const load = useCallback(async () => {
    if (!accessToken) {
      setError('You are not signed in.');
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const res = await fetch(`${getApiBaseUrl()}/api/admin/customers`, { headers: headers() });
      if (!res.ok) throw new Error(await parseError(res, 'Failed to load customers'));
      setCustomers(await res.json());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load customers');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [accessToken, headers]);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setPhone('');
    setPin('');
  };

  const saveCustomer = async () => {
    if (!accessToken) return;
    setBusy(true);
    setError(null);
    try {
      const payload: Record<string, string> = editingId
        ? {
            name,
            phone_number: phone,
            ...(pin.trim() ? { pin: pin.trim() } : {}),
          }
        : {
            name,
            phone_number: phone,
            pin,
          };
      const res = await fetch(
        editingId
          ? `${getApiBaseUrl()}/api/admin/customers/${editingId}`
          : `${getApiBaseUrl()}/api/admin/customers`,
        {
          method: editingId ? 'PUT' : 'POST',
          headers: headers(),
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) throw new Error(await parseError(res, 'Failed to save customer'));
      resetForm();
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save customer');
    } finally {
      setBusy(false);
    }
  };

  const editCustomer = (customer: AdminCustomer) => {
    setEditingId(customer.id);
    setName(customer.name);
    setPhone(customer.phone_number);
    setPin('');
  };

  const deleteCustomer = async (id: string) => {
    if (!accessToken) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/admin/customers/${id}`, {
        method: 'DELETE',
        headers: headers(),
      });
      if (!res.ok) throw new Error(await parseError(res, 'Failed to delete customer'));
      if (editingId === id) resetForm();
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete customer');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
          />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.kicker}>Back Office</Text>
            <Text style={styles.title}>Customers</Text>
          </View>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/(admin)');
              }
            }}
            accessibilityRole="button"
            accessibilityLabel="Back to Admin Dashboard"
          >
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator testID="customers-loading" size="large" color="#000000" />
        ) : (
          <>
            {error ? (
              <View style={styles.errorBox} testID="customers-error">
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>
                {editingId ? 'Edit Customer' : 'New Customer'}
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Customer name"
                placeholderTextColor="#8E8E93"
                value={name}
                onChangeText={setName}
                testID="customer-name"
              />
              <TextInput
                style={styles.input}
                placeholder="e.g. +237690000000"
                placeholderTextColor="#8E8E93"
                value={phone}
                onChangeText={setPhone}
                testID="customer-phone"
              />
              <TextInput
                style={styles.input}
                placeholder={editingId ? 'New PIN (optional)' : '4-digit PIN'}
                placeholderTextColor="#8E8E93"
                keyboardType="number-pad"
                secureTextEntry
                value={pin}
                onChangeText={setPin}
                testID="customer-pin"
              />
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={saveCustomer}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={editingId ? 'Save Customer' : 'Add Customer'}
                testID="save-customer-btn"
              >
                <Text style={styles.primaryButtonText}>
                  {editingId ? 'Save Customer' : 'Add Customer'}
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionTitle}>Roster</Text>
            {customers.map((customer) => (
              <View
                key={customer.id}
                style={styles.itemCard}
                testID={`customer-card-${customer.phone_number}`}
              >
                <Text style={styles.itemTitle}>{customer.name}</Text>
                <Text style={styles.itemMeta}>{customer.phone_number}</Text>
                <Text style={styles.itemPrice}>
                  {formatFcfa(customer.outstanding_balance)} outstanding
                </Text>
                <View style={styles.itemActions}>
                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={() => editCustomer(customer)}
                    accessibilityRole="button"
                    accessibilityLabel={`Edit ${customer.name}`}
                  >
                    <Text style={styles.secondaryButtonText}>Edit / Reset PIN</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.dangerButton}
                    onPress={() => deleteCustomer(customer.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete ${customer.name}`}
                  >
                    <Text style={styles.dangerButtonText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  kicker: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111111',
    marginTop: 4,
  },
  backButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 9999,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backButtonText: {
    color: '#111111',
    fontSize: 13,
    fontWeight: '700',
  },
  errorBox: {
    backgroundColor: '#FDE8E8',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F8B4B4',
    padding: 16,
    marginBottom: 16,
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    padding: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111111',
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#F2F2F7',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#111111',
    marginBottom: 10,
  },
  primaryButton: {
    backgroundColor: '#000000',
    borderRadius: 9999,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  itemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    padding: 18,
    marginBottom: 10,
  },
  itemTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111111',
  },
  itemMeta: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 4,
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111111',
    marginTop: 8,
    marginBottom: 12,
  },
  itemActions: {
    flexDirection: 'row',
    gap: 8,
  },
  secondaryButton: {
    flex: 1,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  secondaryButtonText: {
    color: '#111111',
    fontWeight: '700',
    fontSize: 12,
  },
  dangerButton: {
    borderRadius: 9999,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
  },
  dangerButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
