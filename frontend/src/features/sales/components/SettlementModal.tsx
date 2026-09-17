import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { getApiBaseUrl } from '../../../core/context/AuthContext';

export interface Customer {
  id: string;
  name: string;
  phone_number: string;
  created_at?: string;
}

export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'credit';

export interface SettlementModalProps {
  visible: boolean;
  onClose: () => void;
  orderId: string;
  orderName?: string;
  totalAmount: number;
  apiBaseUrl?: string;
  onSettlementSuccess: (settledOrder: any) => void;
}

const PAYMENT_METHODS: { id: PaymentMethod; label: string }[] = [
  { id: 'cash', label: 'Cash' },
  { id: 'card', label: 'Card' },
  { id: 'transfer', label: 'Bank Transfer' },
  { id: 'credit', label: 'Credit' },
];

export function SettlementModal({
  visible,
  onClose,
  orderId,
  orderName,
  totalAmount,
  apiBaseUrl,
  onSettlementSuccess,
}: SettlementModalProps) {
  const baseUrl = apiBaseUrl ?? getApiBaseUrl();

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('cash');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Credit search / creation state
  const [phoneSearch, setPhoneSearch] = useState<string>('');
  const [isSearchingCustomer, setIsSearchingCustomer] = useState<boolean>(false);
  const [customerNotFound, setCustomerNotFound] = useState<boolean>(false);
  const [newCustomerName, setNewCustomerName] = useState<string>('');
  const [isCreatingCustomer, setIsCreatingCustomer] = useState<boolean>(false);
  const [customerError, setCustomerError] = useState<string | null>(null);

  // Settlement submission state
  const [isSettling, setIsSettling] = useState<boolean>(false);
  const [settlementError, setSettlementError] = useState<string | null>(null);

  // Reset state on open
  useEffect(() => {
    if (visible) {
      setSelectedMethod('cash');
      setSelectedCustomer(null);
      setPhoneSearch('');
      setIsSearchingCustomer(false);
      setCustomerNotFound(false);
      setNewCustomerName('');
      setIsCreatingCustomer(false);
      setCustomerError(null);
      setIsSettling(false);
      setSettlementError(null);
    }
  }, [visible]);

  const handleSearchCustomer = async () => {
    const trimmedPhone = phoneSearch.trim();
    if (!trimmedPhone) {
      setCustomerError('Please enter a phone number');
      return;
    }

    setIsSearchingCustomer(true);
    setCustomerError(null);
    setCustomerNotFound(false);

    try {
      const res = await fetch(
        `${baseUrl}/api/customers?phone=${encodeURIComponent(trimmedPhone)}`
      );
      if (res.ok) {
        const data = await res.json();
        if (data && data.id) {
          setSelectedCustomer(data);
          setCustomerNotFound(false);
        } else {
          setSelectedCustomer(null);
          setCustomerNotFound(true);
        }
      } else {
        const errorData = await res.json().catch(() => null);
        setCustomerError(errorData?.error || `Search failed (${res.status})`);
      }
    } catch (err: any) {
      setCustomerError(err?.message || 'Network error searching customer');
    } finally {
      setIsSearchingCustomer(false);
    }
  };

  const handleCreateCustomer = async () => {
    const trimmedName = newCustomerName.trim();
    const trimmedPhone = phoneSearch.trim();

    if (!trimmedName) {
      setCustomerError('Please enter customer name');
      return;
    }
    if (!trimmedPhone) {
      setCustomerError('Please enter phone number');
      return;
    }

    setIsCreatingCustomer(true);
    setCustomerError(null);

    try {
      const res = await fetch(`${baseUrl}/api/customers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: trimmedName,
          phone_number: trimmedPhone,
        }),
      });

      const data = await res.json();

      if (res.status === 201 || res.ok) {
        setSelectedCustomer(data);
        setCustomerNotFound(false);
        setNewCustomerName('');
      } else {
        setCustomerError(data?.error || `Failed to create customer (${res.status})`);
      }
    } catch (err: any) {
      setCustomerError(err?.message || 'Network error creating customer');
    } finally {
      setIsCreatingCustomer(false);
    }
  };

  const handleChangeCustomer = () => {
    setSelectedCustomer(null);
    setCustomerNotFound(false);
    setCustomerError(null);
  };

  const handleConfirmSettlement = async () => {
    if (isSettling) return;

    if (selectedMethod === 'credit' && !selectedCustomer) {
      setSettlementError('A customer must be attached for credit settlement');
      return;
    }

    setIsSettling(true);
    setSettlementError(null);

    try {
      const payload: { payment_method: string; customer_id?: string } = {
        payment_method: selectedMethod,
      };

      if (selectedMethod === 'credit' && selectedCustomer?.id) {
        payload.customer_id = selectedCustomer.id;
      }

      const res = await fetch(`${baseUrl}/api/orders/${orderId}/settle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok || res.status === 200) {
        onSettlementSuccess(data);
        onClose();
      } else {
        setSettlementError(data?.error || `Settlement failed (${res.status})`);
      }
    } catch (err: any) {
      setSettlementError(err?.message || 'Network error during settlement');
    } finally {
      setIsSettling(false);
    }
  };

  const isConfirmDisabled =
    isSettling || (selectedMethod === 'credit' && !selectedCustomer);

  const formattedTotal = `${(Number(totalAmount) || 0).toLocaleString()} FCFA`;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={styles.keyboardAvoidContainer}
            >
              <View style={styles.card}>
                <ScrollView
                  bounces={false}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.scrollContent}
                >
                  {/* Header */}
                  <View style={styles.header}>
                    <View>
                      <Text style={styles.title}>Settle Order</Text>
                      {orderName ? (
                        <Text style={styles.orderName}>{orderName}</Text>
                      ) : null}
                    </View>
                    <TouchableOpacity
                      onPress={onClose}
                      accessibilityRole="button"
                      accessibilityLabel="Close settlement modal"
                      style={styles.closeButton}
                    >
                      <Text style={styles.closeButtonText}>✕</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Error Alert Banner */}
                  {settlementError && (
                    <View style={styles.errorBanner} testID="settlement-error-banner">
                      <Text style={styles.errorBannerText}>{settlementError}</Text>
                    </View>
                  )}

                  {/* Prominent Total Amount (Display Text) */}
                  <View style={styles.totalSection}>
                    <Text style={styles.totalLabel}>Total Amount</Text>
                    <Text style={styles.totalAmount} testID="settlement-total-amount">
                      {formattedTotal}
                    </Text>
                  </View>

                  {/* Payment Methods */}
                  <Text style={styles.sectionLabel}>Payment Method</Text>
                  <View style={styles.paymentMethodsGrid}>
                    {PAYMENT_METHODS.map((method) => {
                      const isActive = selectedMethod === method.id;
                      return (
                        <TouchableOpacity
                          key={method.id}
                          style={[
                            styles.methodButton,
                            isActive && styles.activeMethodButton,
                          ]}
                          onPress={() => {
                            setSelectedMethod(method.id);
                            setSettlementError(null);
                          }}
                          accessibilityRole="button"
                          accessibilityLabel={method.label}
                          testID={`payment-method-${method.id}`}
                        >
                          <Text
                            style={[
                              styles.methodButtonText,
                              isActive && styles.activeMethodButtonText,
                            ]}
                          >
                            {method.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Credit Customer Flow */}
                  {selectedMethod === 'credit' && (
                    <View style={styles.creditSection} testID="credit-customer-section">
                      <Text style={styles.creditSectionTitle}>Customer Details</Text>

                      {selectedCustomer ? (
                        <View style={styles.customerCard} testID="selected-customer-card">
                          <View style={styles.customerCardInfo}>
                            <Text style={styles.customerCardName}>
                              Customer: {selectedCustomer.name} ({selectedCustomer.phone_number})
                            </Text>
                            <Text style={styles.customerCardId} testID="customer-card-id">
                              ID: {selectedCustomer.id}
                            </Text>
                          </View>
                          <TouchableOpacity
                            style={styles.changeCustomerButton}
                            onPress={handleChangeCustomer}
                            accessibilityRole="button"
                            accessibilityLabel="Change customer"
                            testID="change-customer-button"
                          >
                            <Text style={styles.changeCustomerText}>Change</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <View style={styles.customerSearchContainer}>
                          <View style={styles.searchRow}>
                            <TextInput
                              style={styles.phoneInput}
                              placeholder="Phone number (e.g. +237690000000)"
                              placeholderTextColor="#8E8E93"
                              value={phoneSearch}
                              onChangeText={(text) => {
                                setPhoneSearch(text);
                                setCustomerNotFound(false);
                                setCustomerError(null);
                              }}
                              keyboardType="phone-pad"
                              accessibilityLabel="Customer phone number"
                              testID="customer-phone-input"
                            />
                            <TouchableOpacity
                              style={[
                                styles.searchButton,
                                (!phoneSearch.trim() || isSearchingCustomer) &&
                                  styles.disabledSearchButton,
                              ]}
                              onPress={handleSearchCustomer}
                              disabled={!phoneSearch.trim() || isSearchingCustomer}
                              accessibilityRole="button"
                              accessibilityLabel="Search customer"
                              testID="search-customer-button"
                            >
                              {isSearchingCustomer ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                              ) : (
                                <Text style={styles.searchButtonText}>Search</Text>
                              )}
                            </TouchableOpacity>
                          </View>

                          {customerError && (
                            <Text style={styles.customerErrorText} testID="customer-search-error">
                              {customerError}
                            </Text>
                          )}

                          {customerNotFound && (
                            <View style={styles.notFoundContainer} testID="customer-not-found-section">
                              <Text style={styles.notFoundText} testID="customer-not-found-message">
                                Customer not found
                              </Text>
                              <View style={styles.createCustomerRow}>
                                <TextInput
                                  style={styles.nameInput}
                                  placeholder="Customer name"
                                  placeholderTextColor="#8E8E93"
                                  value={newCustomerName}
                                  onChangeText={setNewCustomerName}
                                  accessibilityLabel="Customer name"
                                  testID="new-customer-name-input"
                                />
                                <TouchableOpacity
                                  style={[
                                    styles.createButton,
                                    (!newCustomerName.trim() || isCreatingCustomer) &&
                                      styles.disabledSearchButton,
                                  ]}
                                  onPress={handleCreateCustomer}
                                  disabled={!newCustomerName.trim() || isCreatingCustomer}
                                  accessibilityRole="button"
                                  accessibilityLabel="Create Customer"
                                  testID="create-customer-button"
                                >
                                  {isCreatingCustomer ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                  ) : (
                                    <Text style={styles.createButtonText}>Create Customer</Text>
                                  )}
                                </TouchableOpacity>
                              </View>
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  )}

                  {/* Actions */}
                  <View style={styles.actionsRow}>
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={onClose}
                      accessibilityRole="button"
                      accessibilityLabel="Cancel"
                      testID="cancel-settlement-button"
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.confirmButton,
                        isConfirmDisabled && styles.disabledConfirmButton,
                      ]}
                      onPress={handleConfirmSettlement}
                      disabled={isConfirmDisabled}
                      accessibilityRole="button"
                      accessibilityLabel="Confirm Settlement"
                      testID="confirm-settlement-button"
                    >
                      {isSettling ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <Text
                          style={[
                            styles.confirmButtonText,
                            isConfirmDisabled && styles.disabledConfirmButtonText,
                          ]}
                        >
                          Confirm Settlement
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </View>
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  keyboardAvoidContainer: {
    width: '100%',
    maxWidth: 460,
    alignItems: 'center',
  },
  card: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    padding: 24,
    // Flat-by-default: zero drop shadows
  },
  scrollContent: {
    flexGrow: 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111111',
    letterSpacing: -0.5,
  },
  orderName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
    marginTop: 2,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#8E8E93',
  },
  errorBanner: {
    backgroundColor: '#FF3B30',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorBannerText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  totalSection: {
    backgroundColor: '#F2F2F7',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  totalLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  totalAmount: {
    fontSize: 32,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: -1,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  paymentMethodsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  methodButton: {
    flex: 1,
    minWidth: '45%',
    minHeight: 48,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  activeMethodButton: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  methodButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111111',
  },
  activeMethodButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  creditSection: {
    backgroundColor: '#F2F2F7',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  creditSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 10,
  },
  customerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  customerCardInfo: {
    flex: 1,
    marginRight: 8,
  },
  customerCardName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111111',
  },
  customerCardId: {
    fontSize: 11,
    color: '#8E8E93',
    marginTop: 2,
  },
  changeCustomerButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    backgroundColor: '#FFFFFF',
  },
  changeCustomerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8E93',
  },
  customerSearchContainer: {
    gap: 10,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  phoneInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111111',
    minHeight: 44,
  },
  searchButton: {
    backgroundColor: '#000000',
    borderRadius: 9999,
    paddingHorizontal: 16,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledSearchButton: {
    backgroundColor: '#E5E5EA',
    opacity: 0.7,
  },
  searchButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  customerErrorText: {
    color: '#FF3B30',
    fontSize: 13,
    fontWeight: '600',
  },
  notFoundContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    padding: 12,
    gap: 8,
  },
  notFoundText: {
    color: '#FF3B30',
    fontSize: 13,
    fontWeight: '600',
  },
  createCustomerRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  nameInput: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#111111',
    minHeight: 40,
  },
  createButton: {
    backgroundColor: '#000000',
    borderRadius: 9999,
    paddingHorizontal: 14,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    minHeight: 52,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  cancelButtonText: {
    color: '#111111',
    fontSize: 15,
    fontWeight: '600',
  },
  confirmButton: {
    flex: 2,
    backgroundColor: '#000000',
    borderRadius: 9999,
    minHeight: 52,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  disabledConfirmButton: {
    backgroundColor: '#E5E5EA',
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  disabledConfirmButtonText: {
    color: '#8E8E93',
  },
});
