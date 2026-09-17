import React, { useState, useEffect } from 'react';
import {
  Modal,
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
import { getApiBaseUrl } from '../../../core/context/AuthContext';
import { RequisitionDetail, RequisitionItem } from '../types';

export interface DeliveryModalProps {
  visible: boolean;
  requisitionId: string | null;
  requisition?: RequisitionDetail | null;
  onClose: () => void;
  onSuccess: () => void;
  apiBaseUrl?: string;
}

export function DeliveryModal({
  visible,
  requisitionId,
  requisition,
  onClose,
  onSuccess,
  apiBaseUrl,
}: DeliveryModalProps) {
  const baseUrl = apiBaseUrl ?? getApiBaseUrl();
  const effectiveId = requisitionId || requisition?.id;

  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [items, setItems] = useState<RequisitionItem[]>([]);
  const [receivedMap, setReceivedMap] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;

    setSubmitError(null);
    setLoadError(null);

    if (requisition?.items && requisition.items.length > 0) {
      setItems(requisition.items);
      const initialMap: Record<string, number> = {};
      requisition.items.forEach((item) => {
        initialMap[item.id] =
          item.received_quantity !== null && item.received_quantity !== undefined
            ? Number(item.received_quantity)
            : Number(item.quantity);
      });
      setReceivedMap(initialMap);
    } else if (effectiveId) {
      fetchRequisitionDetails(effectiveId);
    }
  }, [visible, requisition, effectiveId]);

  const fetchRequisitionDetails = async (id: string) => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`${baseUrl}/api/requisitions/${id}`);
      if (!res.ok) {
        throw new Error(`Failed to load requisition (${res.status})`);
      }
      const data: RequisitionDetail = await res.json();
      setItems(data.items || []);
      const initialMap: Record<string, number> = {};
      (data.items || []).forEach((item) => {
        initialMap[item.id] =
          item.received_quantity !== null && item.received_quantity !== undefined
            ? Number(item.received_quantity)
            : Number(item.quantity);
      });
      setReceivedMap(initialMap);
    } catch (err: any) {
      setLoadError(err.message || 'Failed to fetch items');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateQuantity = (itemId: string, qty: number) => {
    const safeQty = Math.max(0, qty);
    setReceivedMap((prev) => ({
      ...prev,
      [itemId]: safeQty,
    }));
  };

  const handleConfirmDelivery = async () => {
    if (!effectiveId) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const payload = {
        items: items.map((item) => ({
          item_id: item.id,
          received_quantity:
            receivedMap[item.id] !== undefined
              ? Number(receivedMap[item.id])
              : Number(item.quantity),
        })),
      };

      const res = await fetch(`${baseUrl}/api/requisitions/${effectiveId}/deliver`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Error delivering requisition (${res.status})`);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to confirm delivery');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>Receive Delivery</Text>
              {requisition?.title ? (
                <Text style={styles.headerSubtitle}>{requisition.title}</Text>
              ) : null}
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="Close"
              testID="close-delivery-modal-btn"
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollContent} keyboardShouldPersistTaps="handled">
            {submitError && (
              <View style={styles.errorBanner} testID="delivery-error-banner">
                <Text style={styles.errorBannerText}>{submitError}</Text>
              </View>
            )}

            {loading ? (
              <View style={styles.centerLoading}>
                <ActivityIndicator size="small" color="#000000" />
                <Text style={styles.loadingText}>Loading delivery items...</Text>
              </View>
            ) : loadError ? (
              <Text style={styles.errorText}>{loadError}</Text>
            ) : items.length === 0 ? (
              <Text style={styles.emptyText}>No items found in this requisition.</Text>
            ) : (
              <View style={styles.itemsList}>
                <Text style={styles.sectionSubtitle}>
                  Enter received quantities. Partial quantities will mark order as Partial Delivery.
                </Text>

                {items.map((item) => {
                  const currentReceived =
                    receivedMap[item.id] !== undefined
                      ? receivedMap[item.id]
                      : Number(item.quantity);

                  return (
                    <View key={item.id} style={styles.itemCard} testID={`delivery-item-${item.id}`}>
                      <View style={styles.itemInfo}>
                        <Text style={styles.itemName}>
                          {item.product_name || 'Product'}
                        </Text>
                        <Text style={styles.itemOrderedText}>
                          Ordered: {item.quantity} units
                        </Text>
                      </View>

                      <View style={styles.receivingControls}>
                        <Text style={styles.receivedLabel}>Received:</Text>
                        <View style={styles.stepperContainer}>
                          <TouchableOpacity
                            style={styles.stepperBtn}
                            onPress={() => handleUpdateQuantity(item.id, currentReceived - 1)}
                            accessibilityLabel={`Decrease received quantity for ${item.product_name}`}
                            testID={`received-minus-${item.id}`}
                          >
                            <Text style={styles.stepperBtnText}>−</Text>
                          </TouchableOpacity>

                          <TextInput
                            style={styles.receivedInput}
                            keyboardType="numeric"
                            value={String(currentReceived)}
                            onChangeText={(val) => {
                              const parsed = parseInt(val, 10);
                              handleUpdateQuantity(item.id, isNaN(parsed) ? 0 : parsed);
                            }}
                            testID={`received-input-${item.id}`}
                          />

                          <TouchableOpacity
                            style={styles.stepperBtn}
                            onPress={() => handleUpdateQuantity(item.id, currentReceived + 1)}
                            accessibilityLabel={`Increase received quantity for ${item.product_name}`}
                            testID={`received-plus-${item.id}`}
                          >
                            <Text style={styles.stepperBtnText}>+</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </ScrollView>

          {/* Footer Action */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[
                styles.confirmButton,
                (isSubmitting || loading || items.length === 0) && styles.confirmButtonDisabled,
              ]}
              onPress={handleConfirmDelivery}
              disabled={isSubmitting || loading || items.length === 0}
              accessibilityRole="button"
              accessibilityLabel="Confirm Delivery"
              testID="confirm-delivery-btn"
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.confirmButtonText}>Confirm Delivery</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111111',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 2,
  },
  closeButton: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: '#8E8E93',
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
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
    fontWeight: '600',
    textAlign: 'center',
  },
  centerLoading: {
    paddingVertical: 32,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: '#8E8E93',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
    paddingVertical: 16,
    textAlign: 'center',
  },
  emptyText: {
    color: '#8E8E93',
    fontSize: 14,
    paddingVertical: 24,
    textAlign: 'center',
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#8E8E93',
    marginBottom: 14,
    lineHeight: 18,
  },
  itemsList: {
    gap: 12,
    marginBottom: 16,
  },
  itemCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemInfo: {
    flex: 1,
    marginRight: 12,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 4,
  },
  itemOrderedText: {
    fontSize: 13,
    color: '#8E8E93',
  },
  receivingControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  receivedLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111111',
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 9999,
    paddingHorizontal: 4,
  },
  stepperBtn: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperBtnText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111111',
  },
  receivedInput: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111111',
    width: 38,
    textAlign: 'center',
    padding: 0,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  confirmButton: {
    backgroundColor: '#000000',
    borderRadius: 9999,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
  },
  confirmButtonDisabled: {
    opacity: 0.5,
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
