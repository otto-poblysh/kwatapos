import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { getApiBaseUrl } from '../../../core/context/AuthContext';
import { RequisitionDetail } from '../../../features/requisitions/types';

export interface VendorPublicFormProps {
  tokenOverride?: string;
  apiBaseUrl?: string;
}

export default function VendorPublicForm({
  tokenOverride,
  apiBaseUrl,
}: VendorPublicFormProps) {
  const params = useLocalSearchParams<{ token: string }>();
  const token = tokenOverride || params.token;
  const baseUrl = apiBaseUrl ?? getApiBaseUrl();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requisition, setRequisition] = useState<RequisitionDetail | null>(null);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const fetchRequisition = useCallback(async () => {
    if (!token) {
      setError('Invalid or missing requisition token.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${baseUrl}/api/public/requisition/${token}`);
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error('Requisition not found or link has expired.');
        }
        throw new Error(`Failed to load requisition (${res.status})`);
      }
      const data: RequisitionDetail = await res.json();
      setRequisition(data);

      // Pre-fill prices with confirmed_price or expected_price
      const initialPrices: Record<string, string> = {};
      (data.items || []).forEach((item) => {
        const val =
          item.confirmed_price !== null && item.confirmed_price !== undefined
            ? String(item.confirmed_price)
            : String(item.expected_price || '');
        initialPrices[item.id] = val;
      });
      setPrices(initialPrices);
    } catch (err: any) {
      setError(err.message || 'Unable to load requisition');
    } finally {
      setLoading(false);
    }
  }, [token, baseUrl]);

  useEffect(() => {
    fetchRequisition();
  }, [fetchRequisition]);

  const handlePriceChange = (itemId: string, text: string) => {
    if (submitError) {
      setSubmitError(null);
    }
    setPrices((prev) => ({
      ...prev,
      [itemId]: text,
    }));
  };

  const calculateTotal = () => {
    if (!requisition?.items) return 0;
    return requisition.items.reduce((sum, item) => {
      const p = parseFloat(prices[item.id] || '0') || 0;
      return sum + item.quantity * p;
    }, 0);
  };

  const handleSubmit = async () => {
    if (!token || !requisition) return;

    // Validate that all items have a valid confirmed price > 0
    const items = requisition.items || [];
    for (const item of items) {
      const valStr = prices[item.id];
      const parsed = parseFloat(valStr ?? '');
      if (valStr === undefined || valStr.trim() === '' || isNaN(parsed) || parsed <= 0) {
        setSubmitError('Please enter a valid price greater than 0 for all items.');
        return;
      }
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const payload = {
        items: items.map((item) => ({
          item_id: item.id,
          confirmed_price: parseFloat(prices[item.id]),
        })),
      };

      const res = await fetch(`${baseUrl}/api/public/requisition/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Failed to submit prices (${res.status})`);
      }

      setIsSuccess(true);
    } catch (err: any) {
      setSubmitError(err.message || 'Submission failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer} testID="vendor-loading-container">
        <ActivityIndicator size="large" color="#000000" testID="vendor-loading" />
        <Text style={styles.loadingText}>Loading requisition...</Text>
      </SafeAreaView>
    );
  }

  if (error || !requisition) {
    return (
      <SafeAreaView style={styles.centerContainer} testID="vendor-error-container">
        <View style={styles.errorCard}>
          <Text style={styles.errorCardTitle}>Unable to Open Order</Text>
          <Text style={styles.errorText} testID="vendor-error">
            {error || 'Requisition not found.'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const totalConfirmed = calculateTotal();

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Top Branding / Header */}
          <View style={styles.header}>
            <Text style={styles.headerSubtitle}>KWATA POS • VENDOR PORTAL</Text>
            <Text style={styles.headerTitle}>Vendor Price Confirmation</Text>
          </View>

          {/* Success Banner */}
          {isSuccess && (
            <View style={styles.successBanner} testID="vendor-success-banner">
              <View style={styles.successIconContainer}>
                <Text style={styles.successIcon}>✓</Text>
              </View>
              <Text style={styles.successTitle}>Prices Confirmed!</Text>
              <Text style={styles.successMessage}>
                Prices Confirmed! Thank you. The manager has been notified.
              </Text>
            </View>
          )}

          {/* Submission Error Banner */}
          {submitError && (
            <View style={styles.submitErrorBanner} testID="vendor-submit-error">
              <Text style={styles.submitErrorText}>{submitError}</Text>
            </View>
          )}

          {/* Requisition Overview Card */}
          <View style={styles.overviewCard}>
            <Text style={styles.overviewLabel}>ORDER DETAILS</Text>
            <Text style={styles.requisitionTitle}>{requisition.title}</Text>
            <Text style={styles.overviewMeta}>
              {requisition.items.length} item{requisition.items.length !== 1 ? 's' : ''} requested
            </Text>
          </View>

          {/* Items to Confirm */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>CONFIRM UNIT PRICES</Text>
          </View>

          {requisition.items.map((item) => {
            const currentPrice = prices[item.id] || '';
            const unitPriceNum = parseFloat(currentPrice) || 0;
            const subtotal = item.quantity * unitPriceNum;

            return (
              <View key={item.id} style={styles.itemCard} testID={`vendor-item-${item.id}`}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemName}>{item.product_name || 'Item'}</Text>
                  <View style={styles.qtyBadge}>
                    <Text style={styles.qtyBadgeText}>Qty: {item.quantity}</Text>
                  </View>
                </View>

                <View style={styles.priceRow}>
                  <View style={styles.priceInputContainer}>
                    <Text style={styles.inputLabel}>Unit Price (FCFA)</Text>
                    <TextInput
                      style={styles.priceInput}
                      keyboardType="numeric"
                      value={currentPrice}
                      onChangeText={(val) => handlePriceChange(item.id, val)}
                      editable={!isSuccess}
                      placeholder="0"
                      placeholderTextColor="#8E8E93"
                      testID={`price-input-${item.id}`}
                    />
                  </View>

                  <View style={styles.subtotalContainer}>
                    <Text style={styles.subtotalLabel}>Subtotal</Text>
                    <Text style={styles.subtotalValue}>{subtotal.toLocaleString()} FCFA</Text>
                  </View>
                </View>
              </View>
            );
          })}

          {/* Number Prominence: Total Section */}
          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>TOTAL CONFIRMED VALUE</Text>
            <Text style={styles.totalValue} testID="vendor-total-value">
              {totalConfirmed.toLocaleString()} FCFA
            </Text>
          </View>

          {/* Confirm & Submit Button */}
          {!isSuccess && (
            <TouchableOpacity
              style={[
                styles.submitButton,
                isSubmitting && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={isSubmitting}
              accessibilityRole="button"
              accessibilityLabel="Confirm & Submit Prices"
              testID="confirm-submit-prices-btn"
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>Confirm & Submit Prices</Text>
              )}
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#F2F2F7',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#8E8E93',
  },
  errorCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    padding: 32,
    alignItems: 'center',
    maxWidth: 420,
    width: '100%',
  },
  errorCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#FF3B30',
    textAlign: 'center',
    lineHeight: 20,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    marginBottom: 20,
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8E8E93',
    letterSpacing: 1,
    marginBottom: 6,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#111111',
    letterSpacing: -0.5,
  },
  successBanner: {
    backgroundColor: '#34C759',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  successIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  successIcon: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: '800',
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  successMessage: {
    fontSize: 15,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 20,
  },
  submitErrorBanner: {
    backgroundColor: '#FF3B30',
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
  },
  submitErrorText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  overviewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    padding: 20,
    marginBottom: 20,
  },
  overviewLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8E8E93',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  requisitionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 4,
  },
  overviewMeta: {
    fontSize: 14,
    color: '#8E8E93',
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8E8E93',
    letterSpacing: 0.5,
  },
  itemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    padding: 18,
    marginBottom: 12,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111111',
    flex: 1,
    marginRight: 10,
  },
  qtyBadge: {
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
  },
  qtyBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111111',
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 16,
  },
  priceInputContainer: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 6,
  },
  priceInput: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    fontWeight: '700',
    color: '#111111',
    minHeight: 44,
  },
  subtotalContainer: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingBottom: 8,
  },
  subtotalLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 2,
  },
  subtotalValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111111',
  },
  totalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    padding: 24,
    alignItems: 'center',
    marginVertical: 16,
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8E8E93',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  totalValue: {
    fontSize: 32,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: -1,
  },
  submitButton: {
    backgroundColor: '#000000',
    borderRadius: 9999,
    minHeight: 52,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    marginBottom: 40,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
