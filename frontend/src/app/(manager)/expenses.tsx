import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { getApiBaseUrl } from '../../core/context/AuthContext';
import { DirectExpense, ExpenseStatus } from '../../features/expenses/types';

export interface ManagerExpensesScreenProps {
  apiBaseUrl?: string;
}

type FilterStatus = 'all' | ExpenseStatus;

export default function ManagerExpensesScreen({ apiBaseUrl }: ManagerExpensesScreenProps) {
  const router = useRouter();
  const baseUrl = apiBaseUrl ?? getApiBaseUrl();

  const [expenses, setExpenses] = useState<DirectExpense[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [activeFilter, setActiveFilter] = useState<FilterStatus>('all');
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const fetchExpenses = useCallback(
    async (isPull = false) => {
      if (isPull) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const res = await fetch(`${baseUrl}/api/expenses`);
        if (!res.ok) {
          throw new Error(`Failed to load expenses (${res.status})`);
        }
        const data = await res.json();
        setExpenses(Array.isArray(data) ? data : []);
      } catch (err: any) {
        setError(err?.message || 'Failed to fetch expenses');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [baseUrl]
  );

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.push('/(manager)');
    }
  };

  const handleApprove = async (expenseId: string) => {
    setApprovingId(expenseId);
    try {
      const res = await fetch(`${baseUrl}/api/expenses/${expenseId}/approve`, {
        method: 'POST',
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Approval failed (${res.status})`);
      }

      showToast('Expense approved successfully!');
      fetchExpenses();
    } catch (err: any) {
      showToast(err?.message || 'Failed to approve expense');
    } finally {
      setApprovingId(null);
    }
  };

  const formatCurrency = (amount: number | string) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : Number(amount);
    return `${(isNaN(num) ? 0 : num).toLocaleString()} FCFA`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  const filteredExpenses = expenses.filter((item) => {
    if (activeFilter === 'all') return true;
    return item.status === activeFilter;
  });

  const requestedCount = expenses.filter((e) => e.status === 'requested').length;
  const approvedCount = expenses.filter((e) => e.status === 'approved').length;
  const reconciledCount = expenses.filter((e) => e.status === 'receipt_uploaded').length;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBack}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            testID="manager-expenses-back-btn"
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Direct Expenses Oversight</Text>
            <Text style={styles.headerSubtitle}>Approve cash requests & audit receipts</Text>
          </View>
        </View>
      </View>

      {/* Toast Notification */}
      {toastMessage && (
        <View style={styles.toast} testID="manager-expenses-toast">
          <Text style={styles.toastText}>{toastMessage}</Text>
          <TouchableOpacity
            onPress={() => setToastMessage(null)}
            accessibilityRole="button"
            accessibilityLabel="Dismiss toast"
          >
            <Text style={styles.toastDismiss}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          <TouchableOpacity
            style={[styles.filterChip, activeFilter === 'all' && styles.filterChipActive]}
            onPress={() => setActiveFilter('all')}
            accessibilityRole="button"
            accessibilityLabel="All expenses filter"
            testID="filter-all"
          >
            <Text
              style={[
                styles.filterChipText,
                activeFilter === 'all' && styles.filterChipTextActive,
              ]}
            >
              All ({expenses.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterChip,
              activeFilter === 'requested' && styles.filterChipActive,
            ]}
            onPress={() => setActiveFilter('requested')}
            accessibilityRole="button"
            accessibilityLabel="Pending approval filter"
            testID="filter-requested"
          >
            <Text
              style={[
                styles.filterChipText,
                activeFilter === 'requested' && styles.filterChipTextActive,
              ]}
            >
              Pending Approval ({requestedCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterChip,
              activeFilter === 'approved' && styles.filterChipActive,
            ]}
            onPress={() => setActiveFilter('approved')}
            accessibilityRole="button"
            accessibilityLabel="Approved filter"
            testID="filter-approved"
          >
            <Text
              style={[
                styles.filterChipText,
                activeFilter === 'approved' && styles.filterChipTextActive,
              ]}
            >
              Approved ({approvedCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterChip,
              activeFilter === 'receipt_uploaded' && styles.filterChipActive,
            ]}
            onPress={() => setActiveFilter('receipt_uploaded')}
            accessibilityRole="button"
            accessibilityLabel="Reconciled filter"
            testID="filter-reconciled"
          >
            <Text
              style={[
                styles.filterChipText,
                activeFilter === 'receipt_uploaded' && styles.filterChipTextActive,
              ]}
            >
              Reconciled ({reconciledCount})
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Main Content */}
      {loading ? (
        <View style={styles.loadingContainer} testID="manager-expenses-loading">
          <ActivityIndicator size="large" color="#000000" />
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => fetchExpenses(false)}
            accessibilityRole="button"
            accessibilityLabel="Retry"
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : filteredExpenses.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.emptyContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchExpenses(true)}
              tintColor="#000000"
            />
          }
        >
          <View style={styles.emptyCard} testID="empty-expenses-state">
            <Text style={styles.emptyTitle}>No Expenses Found</Text>
            <Text style={styles.emptySubtitle}>
              {activeFilter === 'all'
                ? 'No direct expenses recorded yet.'
                : `No expenses matching filter "${activeFilter}".`}
            </Text>
          </View>
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchExpenses(true)}
              tintColor="#000000"
            />
          }
        >
          <View style={styles.listContainer}>
            {filteredExpenses.map((expense) => {
              const isApproving = approvingId === expense.id;

              return (
                <View
                  key={expense.id}
                  style={styles.card}
                  testID={`manager-expense-item-${expense.id}`}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.cardHeaderLeft}>
                      <Text style={styles.cardCategory}>{expense.category}</Text>
                      <Text style={styles.cardDate}>{formatDate(expense.created_at)}</Text>
                    </View>

                    {/* Status Badges */}
                    {expense.status === 'requested' && (
                      <View style={styles.badgeAmber} testID={`badge-requested-${expense.id}`}>
                        <Text style={styles.badgeAmberText}>Pending Approval</Text>
                      </View>
                    )}
                    {expense.status === 'approved' && (
                      <View style={styles.badgeBlue} testID={`badge-approved-${expense.id}`}>
                        <Text style={styles.badgeBlueText}>Approved</Text>
                      </View>
                    )}
                    {expense.status === 'receipt_uploaded' && (
                      <View style={styles.badgeGreen} testID={`badge-reconciled-${expense.id}`}>
                        <Text style={styles.badgeGreenText}>Reconciled</Text>
                      </View>
                    )}
                  </View>

                  {/* Financial Amount */}
                  <View style={styles.amountContainer}>
                    <Text style={styles.amountLabel}>Requested Amount</Text>
                    <Text style={styles.amountText}>{formatCurrency(expense.amount)}</Text>
                  </View>

                  {/* Notes */}
                  {Boolean(expense.notes) && (
                    <View style={styles.notesContainer}>
                      <Text style={styles.notesText}>{expense.notes}</Text>
                    </View>
                  )}

                  {/* Action / Receipt Preview Section */}
                  <View style={styles.cardFooter}>
                    {expense.status === 'requested' && (
                      <TouchableOpacity
                        style={[styles.approveButton, isApproving && styles.disabledButton]}
                        onPress={() => handleApprove(expense.id)}
                        disabled={isApproving}
                        accessibilityRole="button"
                        accessibilityLabel="Approve"
                        testID={`approve-btn-${expense.id}`}
                      >
                        {isApproving ? (
                          <ActivityIndicator color="#FFFFFF" size="small" />
                        ) : (
                          <Text style={styles.approveButtonText}>Approve Expense</Text>
                        )}
                      </TouchableOpacity>
                    )}

                    {expense.status === 'approved' && (
                      <View style={styles.awaitingUploadContainer}>
                        <Text style={styles.awaitingUploadText}>
                          Approved • Waiting for staff to upload receipt
                        </Text>
                      </View>
                    )}

                    {expense.status === 'receipt_uploaded' && expense.receipt_image_url && (
                      <View style={styles.receiptContainer}>
                        <Image
                          source={{ uri: expense.receipt_image_url }}
                          style={styles.receiptThumbnail}
                          accessibilityLabel="Receipt thumbnail"
                          testID={`receipt-thumbnail-${expense.id}`}
                        />
                        <View style={styles.receiptInfo}>
                          <Text style={styles.receiptLabel}>Receipt Verified</Text>
                          <Text style={styles.receiptAmount}>
                            {formatCurrency(expense.amount)} accounted
                          </Text>
                        </View>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 9999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    color: '#111111',
    fontSize: 14,
    fontWeight: '700',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111111',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#8E8E93',
    fontWeight: '500',
    marginTop: 2,
  },
  toast: {
    backgroundColor: '#111111',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  toastDismiss: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    paddingLeft: 12,
  },
  filterContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  filterScroll: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    backgroundColor: '#F2F2F7',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 9999,
    paddingVertical: 8,
    paddingHorizontal: 16,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterChipActive: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111111',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#000000',
    borderRadius: 9999,
    paddingVertical: 12,
    paddingHorizontal: 24,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  listContainer: {
    flexDirection: 'column',
    gap: 16,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    padding: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  cardHeaderLeft: {
    flex: 1,
    marginRight: 12,
  },
  cardCategory: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111111',
  },
  cardDate: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '500',
    marginTop: 2,
  },
  badgeAmber: {
    backgroundColor: '#FFF3D6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  badgeAmberText: {
    color: '#B45309',
    fontSize: 12,
    fontWeight: '700',
  },
  badgeBlue: {
    backgroundColor: '#E1F0FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  badgeBlueText: {
    color: '#0055D6',
    fontSize: 12,
    fontWeight: '700',
  },
  badgeGreen: {
    backgroundColor: '#E4F9E8',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  badgeGreenText: {
    color: '#1C1C1E',
    fontSize: 12,
    fontWeight: '700',
  },
  amountContainer: {
    marginVertical: 4,
  },
  amountLabel: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '600',
    marginBottom: 2,
  },
  amountText: {
    fontSize: 26,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: -0.5,
  },
  notesContainer: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    padding: 10,
    marginTop: 8,
  },
  notesText: {
    fontSize: 14,
    color: '#111111',
    lineHeight: 18,
  },
  cardFooter: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  approveButton: {
    backgroundColor: '#000000',
    borderRadius: 9999,
    paddingVertical: 12,
    paddingHorizontal: 24,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  approveButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  disabledButton: {
    backgroundColor: '#8E8E93',
  },
  awaitingUploadContainer: {
    paddingVertical: 6,
  },
  awaitingUploadText: {
    fontSize: 13,
    color: '#8E8E93',
    fontStyle: 'italic',
  },
  receiptContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  receiptThumbnail: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: '#F2F2F7',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  receiptInfo: {
    flexDirection: 'column',
  },
  receiptLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111111',
  },
  receiptAmount: {
    fontSize: 13,
    color: '#34C759',
    fontWeight: '700',
    marginTop: 2,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    padding: 32,
    alignItems: 'center',
    maxWidth: 420,
    width: '100%',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111111',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 20,
  },
});
