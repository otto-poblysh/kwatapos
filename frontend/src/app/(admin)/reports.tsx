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
import { useRouter } from 'expo-router';
import { getApiBaseUrl, useAuth } from '../../core/hooks/useAuth';

interface DailyReport {
  date: string;
  total_sales: string | number;
  by_payment_method: Record<string, string | number>;
  credit_issued: string | number;
  direct_expenses: string | number;
  expected_cash_drawer: string | number;
}

function formatFcfa(value: string | number | undefined): string {
  const num = typeof value === 'number' ? value : Number(value ?? 0);
  return `${(Number.isNaN(num) ? 0 : num).toLocaleString()} FCFA`;
}

function methodLabel(method: string): string {
  switch (method) {
    case 'cash':
      return 'Cash';
    case 'transfer':
      return 'Transfer';
    case 'card':
      return 'Card';
    case 'credit':
      return 'Credit';
    default:
      return method;
  }
}

export default function AdminReportsScreen() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const [report, setReport] = useState<DailyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadReport = useCallback(async () => {
    if (!accessToken) {
      setError('You are not signed in.');
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const res = await fetch(`${getApiBaseUrl()}/api/reports/daily`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || `Failed to load daily report (${res.status})`);
      }
      setReport(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load daily report');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [accessToken]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const paymentEntries = Object.entries(report?.by_payment_method ?? {});

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadReport();
            }}
          />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.kicker}>End of Shift</Text>
            <Text style={styles.title}>Daily Report</Text>
            <Text style={styles.date} testID="report-date">
              {report?.date ?? 'Today'}
            </Text>
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
            testID="reports-back-button"
          >
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator
            testID="reports-loading"
            size="large"
            color="#000000"
            style={styles.loader}
          />
        ) : error ? (
          <View style={styles.errorBox} testID="reports-error">
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : (
          <>
            <View style={styles.cardsGrid}>
              <View style={[styles.summaryCard, styles.cardDark]} testID="card-total-sales">
                <Text style={styles.cardLabelDark}>Total Sales</Text>
                <Text style={styles.cardValueDark}>{formatFcfa(report?.total_sales)}</Text>
              </View>
              <View style={[styles.summaryCard, styles.cardAccent]} testID="card-cash-drawer">
                <Text style={styles.cardLabel}>Expected Cash in Drawer</Text>
                <Text style={styles.cardValue}>{formatFcfa(report?.expected_cash_drawer)}</Text>
              </View>
              <View style={styles.summaryCard} testID="card-credit-issued">
                <Text style={styles.cardLabel}>Credit Issued Today</Text>
                <Text style={styles.cardValue}>{formatFcfa(report?.credit_issued)}</Text>
              </View>
              <View style={styles.summaryCard} testID="card-direct-expenses">
                <Text style={styles.cardLabel}>Direct Expenses</Text>
                <Text style={styles.cardValue}>{formatFcfa(report?.direct_expenses)}</Text>
              </View>
            </View>

            <Text style={styles.sectionTitle}>By Payment Method</Text>
            {paymentEntries.map(([method, amount]) => (
              <View key={method} style={styles.methodRow} testID={`method-row-${method}`}>
                <Text style={styles.methodLabel}>{methodLabel(method)}</Text>
                <Text style={styles.methodValue}>{formatFcfa(amount)}</Text>
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
  date: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2,
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
  cardsGrid: {
    gap: 12,
    marginBottom: 24,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    padding: 20,
  },
  cardDark: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  cardAccent: {
    backgroundColor: '#E4F9E8',
    borderColor: '#CDEECC',
  },
  cardLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  cardLabelDark: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  cardValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111111',
    marginTop: 8,
    letterSpacing: -0.6,
  },
  cardValueDark: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 8,
    letterSpacing: -0.6,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111111',
    marginBottom: 12,
  },
  methodRow: {
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
  methodLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111111',
  },
  methodValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111111',
  },
});
