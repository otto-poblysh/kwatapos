import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getApiBaseUrl, useAuth } from '../../core/hooks/useAuth';

interface CreditHistoryItem {
  id: string;
  order_id: string;
  amount: string | number;
  status: string;
  created_at: string;
}

interface CustomerPortalProfile {
  id: string;
  name: string;
  phone_number: string;
  outstanding_balance: string | number;
  credits: CreditHistoryItem[];
}

function formatFcfa(value: string | number): string {
  const num = typeof value === 'number' ? value : Number(value);
  return `${(Number.isNaN(num) ? 0 : num).toLocaleString()} FCFA`;
}

function formatCreditDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function creditStatusLabel(status: string): string {
  switch (status) {
    case 'unpaid':
      return 'Unpaid';
    case 'paid':
      return 'Paid';
    default:
      return status;
  }
}

export default function CustomerDashboardScreen() {
  const { user, accessToken, logout } = useAuth();
  const [profile, setProfile] = useState<CustomerPortalProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    if (!accessToken) {
      setError('You are not signed in.');
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const res = await fetch(`${getApiBaseUrl()}/api/customer/me`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || `Failed to load account (${res.status})`);
      }
      setProfile(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load account');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [accessToken]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const credits = profile?.credits ?? [];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadProfile();
            }}
          />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.kicker}>Customer Portal</Text>
            <Text style={styles.name}>{profile?.name ?? user?.email ?? 'Customer'}</Text>
            <Text style={styles.phone}>{profile?.phone_number ?? ''}</Text>
          </View>
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={logout}
            accessibilityRole="button"
            accessibilityLabel="Log Out"
            testID="customer-logout-button"
          >
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator
            testID="customer-dashboard-loading"
            size="large"
            color="#000000"
            style={styles.loader}
          />
        ) : error ? (
          <View style={styles.errorBox} testID="customer-dashboard-error">
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : (
          <>
            <View style={styles.balanceCard} testID="outstanding-balance-card">
              <Text style={styles.balanceLabel}>Total Outstanding Balance</Text>
              <Text style={styles.balanceValue} testID="outstanding-balance-value">
                {formatFcfa(profile?.outstanding_balance ?? 0)}
              </Text>
            </View>

            <Text style={styles.sectionTitle}>Credit History</Text>
            {credits.length === 0 ? (
              <View style={styles.emptyState} testID="credits-empty-state">
                <Text style={styles.emptyTitle}>No credit orders yet</Text>
                <Text style={styles.emptySubtitle}>
                  When you settle on credit, those orders will appear here.
                </Text>
              </View>
            ) : (
              credits.map((credit) => (
                <View key={credit.id} style={styles.creditRow} testID={`credit-row-${credit.id}`}>
                  <View style={styles.creditInfo}>
                    <Text style={styles.creditDate}>{formatCreditDate(credit.created_at)}</Text>
                    <Text style={styles.creditStatus}>{creditStatusLabel(credit.status)}</Text>
                  </View>
                  <Text style={styles.creditAmount}>{formatFcfa(credit.amount)}</Text>
                </View>
              ))
            )}
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
  name: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111111',
    marginTop: 4,
  },
  phone: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2,
  },
  logoutButton: {
    backgroundColor: '#000000',
    borderRadius: 9999,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  logoutText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  loader: {
    marginTop: 48,
  },
  errorBox: {
    backgroundColor: '#FDE8E8',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F8B4B4',
    padding: 16,
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  balanceCard: {
    backgroundColor: '#000000',
    borderRadius: 24,
    padding: 24,
    marginBottom: 24,
  },
  balanceLabel: {
    color: '#8E8E93',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  balanceValue: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '800',
    marginTop: 8,
    letterSpacing: -1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111111',
    marginBottom: 12,
  },
  emptyState: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    padding: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111111',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 6,
  },
  creditRow: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  creditInfo: {
    flex: 1,
    marginRight: 12,
  },
  creditDate: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111111',
  },
  creditStatus: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 2,
    textTransform: 'capitalize',
  },
  creditAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111111',
  },
});
