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
import * as ImagePicker from 'expo-image-picker';
import { getApiBaseUrl } from '../../core/context/AuthContext';
import { ExpenseRequestModal } from '../../features/expenses/components/ExpenseRequestModal';
import { DirectExpense } from '../../features/expenses/types';

export interface SalesExpensesScreenProps {
  apiBaseUrl?: string;
}

export default function SalesExpensesScreen({ apiBaseUrl }: SalesExpensesScreenProps) {
  const router = useRouter();
  const baseUrl = apiBaseUrl ?? getApiBaseUrl();

  const [expenses, setExpenses] = useState<DirectExpense[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
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
      router.push('/(sales)');
    }
  };

  const handleUploadReceipt = async (expenseId: string) => {
    setUploadingId(expenseId);
    try {
      let result: ImagePicker.ImagePickerResult | null = null;
      try {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (perm.granted) {
          result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            base64: true,
            quality: 0.7,
          });
        } else {
          result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            base64: true,
            quality: 0.7,
          });
        }
      } catch {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          base64: true,
          quality: 0.7,
        });
      }

      if (!result || result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      const base64Data = asset.base64;
      if (!base64Data) {
        showToast('No image data captured');
        return;
      }

      const receipt_image_url = `data:image/jpeg;base64,${base64Data}`;

      const res = await fetch(`${baseUrl}/api/expenses/${expenseId}/receipt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ receipt_image_url }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Upload failed (${res.status})`);
      }

      showToast('Receipt uploaded successfully!');
      fetchExpenses();
    } catch (err: any) {
      showToast(err?.message || 'Failed to upload receipt');
    } finally {
      setUploadingId(null);
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
            testID="sales-expenses-back-btn"
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Expenses & Cash Requests</Text>
            <Text style={styles.headerSubtitle}>Direct cash outlays & receipts</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.newRequestButton}
          onPress={() => setModalVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="New Cash Request"
          testID="new-cash-request-btn"
        >
          <Text style={styles.newRequestButtonText}>+ New Cash Request</Text>
        </TouchableOpacity>
      </View>

      {/* Toast Notification */}
      {toastMessage && (
        <View style={styles.toast} testID="expenses-toast">
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

      {/* Main Content */}
      {loading ? (
        <View style={styles.loadingContainer} testID="expenses-loading">
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
      ) : expenses.length === 0 ? (
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
            <Text style={styles.emptyTitle}>No Expenses Recorded</Text>
            <Text style={styles.emptySubtitle}>
              Direct expense requests and uploaded receipts will appear here.
            </Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => setModalVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="New Cash Request"
            >
              <Text style={styles.emptyButtonText}>New Cash Request</Text>
            </TouchableOpacity>
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
            {expenses.map((expense) => {
              const isUploading = uploadingId === expense.id;

              return (
                <View
                  key={expense.id}
                  style={styles.card}
                  testID={`expense-item-${expense.id}`}
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
                    <Text style={styles.amountLabel}>Amount</Text>
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
                    {expense.status === 'approved' && (
                      <TouchableOpacity
                        style={[styles.uploadButton, isUploading && styles.disabledButton]}
                        onPress={() => handleUploadReceipt(expense.id)}
                        disabled={isUploading}
                        accessibilityRole="button"
                        accessibilityLabel="Upload Receipt"
                        testID={`upload-receipt-btn-${expense.id}`}
                      >
                        {isUploading ? (
                          <ActivityIndicator color="#FFFFFF" size="small" />
                        ) : (
                          <Text style={styles.uploadButtonText}>Upload Receipt</Text>
                        )}
                      </TouchableOpacity>
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
                          <Text style={styles.receiptLabel}>Receipt Attached</Text>
                          <Text style={styles.receiptSub}>Verified & reconciled</Text>
                        </View>
                      </View>
                    )}

                    {expense.status === 'requested' && (
                      <Text style={styles.awaitingApprovalText}>
                        Awaiting manager approval before spending/receipt
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}

      {/* Expense Request Modal */}
      <ExpenseRequestModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSuccess={() => {
          showToast('Expense request submitted!');
          fetchExpenses();
        }}
        apiBaseUrl={baseUrl}
      />
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
    flexWrap: 'wrap',
    gap: 12,
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
  newRequestButton: {
    backgroundColor: '#000000',
    borderRadius: 9999,
    paddingVertical: 10,
    paddingHorizontal: 20,
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  newRequestButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
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
  uploadButton: {
    backgroundColor: '#000000',
    borderRadius: 9999,
    paddingVertical: 12,
    paddingHorizontal: 22,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  disabledButton: {
    backgroundColor: '#8E8E93',
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
  receiptSub: {
    fontSize: 12,
    color: '#34C759',
    fontWeight: '600',
    marginTop: 2,
  },
  awaitingApprovalText: {
    fontSize: 13,
    color: '#8E8E93',
    fontStyle: 'italic',
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
    marginBottom: 20,
    lineHeight: 20,
  },
  emptyButton: {
    backgroundColor: '#000000',
    borderRadius: 9999,
    paddingVertical: 14,
    paddingHorizontal: 24,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
