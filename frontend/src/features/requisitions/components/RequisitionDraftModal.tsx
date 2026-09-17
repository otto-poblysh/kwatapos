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

export interface Product {
  id: string;
  name: string;
  price: number | string;
  category?: string;
}

export interface DraftItem {
  product_id: string;
  product_name: string;
  quantity: number;
  expected_price: number | string;
}

export interface RequisitionDraftModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  apiBaseUrl?: string;
}

export function RequisitionDraftModal({
  visible,
  onClose,
  onSuccess,
  apiBaseUrl,
}: RequisitionDraftModalProps) {
  const baseUrl = apiBaseUrl ?? getApiBaseUrl();

  const [title, setTitle] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productError, setProductError] = useState<string | null>(null);

  const [selectedItems, setSelectedItems] = useState<DraftItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setTitle('');
      setSelectedItems([]);
      setSubmitError(null);
      fetchProducts();
    }
  }, [visible]);

  const fetchProducts = async () => {
    setLoadingProducts(true);
    setProductError(null);
    try {
      const res = await fetch(`${baseUrl}/api/products`);
      if (!res.ok) {
        throw new Error(`Failed to load products (${res.status})`);
      }
      const data = await res.json();
      const normalized = Array.isArray(data)
        ? data.map((p: any) => ({
            ...p,
            price: typeof p.price === 'string' ? parseFloat(p.price) : Number(p.price),
          }))
        : [];
      setProducts(normalized);
    } catch (err: any) {
      setProductError(err?.message || 'Failed to load products');
    } finally {
      setLoadingProducts(false);
    }
  };

  const handleAddProduct = (prod: Product) => {
    const existingIndex = selectedItems.findIndex((i) => i.product_id === prod.id);
    const unitPrice = typeof prod.price === 'number' ? prod.price : parseFloat(prod.price) || 0;

    if (existingIndex >= 0) {
      const updated = [...selectedItems];
      updated[existingIndex].quantity += 1;
      setSelectedItems(updated);
    } else {
      setSelectedItems([
        ...selectedItems,
        {
          product_id: prod.id,
          product_name: prod.name,
          quantity: 1,
          expected_price: unitPrice,
        },
      ]);
    }
  };

  const handleUpdateQuantity = (productId: string, qty: number) => {
    if (qty <= 0) {
      setSelectedItems(selectedItems.filter((i) => i.product_id !== productId));
    } else {
      setSelectedItems(
        selectedItems.map((i) => (i.product_id === productId ? { ...i, quantity: qty } : i))
      );
    }
  };

  const handleUpdatePrice = (productId: string, priceStr: string) => {
    setSelectedItems(
      selectedItems.map((i) =>
        i.product_id === productId ? { ...i, expected_price: priceStr } : i
      )
    );
  };

  const handleRemoveItem = (productId: string) => {
    setSelectedItems(selectedItems.filter((i) => i.product_id !== productId));
  };

  const estimatedTotal = selectedItems.reduce((acc, item) => {
    const p = typeof item.expected_price === 'number'
      ? item.expected_price
      : parseFloat(item.expected_price) || 0;
    return acc + item.quantity * p;
  }, 0);

  const handleCreateRequisition = async () => {
    if (selectedItems.length === 0) {
      setSubmitError('Please select at least one product.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const payload = {
        title: title.trim() || 'New Requisition',
        items: selectedItems.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          expected_price:
            typeof item.expected_price === 'number'
              ? item.expected_price
              : parseFloat(item.expected_price) || 0,
        })),
      };

      const res = await fetch(`${baseUrl}/api/requisitions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Error creating requisition (${res.status})`);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to create requisition');
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
            <Text style={styles.headerTitle}>Draft Requisition</Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="Close"
              testID="close-draft-modal-btn"
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollContent} keyboardShouldPersistTaps="handled">
            {/* Title Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>REQUISITION TITLE</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Weekly Bar Restock"
                placeholderTextColor="#8E8E93"
                value={title}
                onChangeText={setTitle}
                testID="requisition-title-input"
              />
            </View>

            {/* Error Banner */}
            {submitError && (
              <View style={styles.errorBanner} testID="draft-error-banner">
                <Text style={styles.errorBannerText}>{submitError}</Text>
              </View>
            )}

            {/* Selected Items */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>ORDER ITEMS ({selectedItems.length})</Text>
            </View>

            {selectedItems.length === 0 ? (
              <View style={styles.emptyItemsBox}>
                <Text style={styles.emptyItemsText}>
                  No products added yet. Select from the product catalog below.
                </Text>
              </View>
            ) : (
              selectedItems.map((item) => {
                const unitPrice =
                  typeof item.expected_price === 'number'
                    ? item.expected_price
                    : parseFloat(item.expected_price) || 0;
                const subtotal = item.quantity * unitPrice;

                return (
                  <View key={item.product_id} style={styles.itemCard} testID={`item-row-${item.product_id}`}>
                    <View style={styles.itemTopRow}>
                      <Text style={styles.itemName}>{item.product_name}</Text>
                      <TouchableOpacity
                        onPress={() => handleRemoveItem(item.product_id)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityLabel={`Remove ${item.product_name}`}
                      >
                        <Text style={styles.removeText}>✕</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.itemControlsRow}>
                      {/* Quantity Stepper */}
                      <View style={styles.stepperContainer}>
                        <TouchableOpacity
                          style={styles.stepperBtn}
                          onPress={() => handleUpdateQuantity(item.product_id, item.quantity - 1)}
                          accessibilityLabel={`Decrease quantity for ${item.product_name}`}
                          testID={`qty-minus-${item.product_id}`}
                        >
                          <Text style={styles.stepperBtnText}>−</Text>
                        </TouchableOpacity>
                        <TextInput
                          style={styles.qtyInput}
                          keyboardType="numeric"
                          value={String(item.quantity)}
                          onChangeText={(t) => {
                            const val = parseInt(t, 10);
                            handleUpdateQuantity(item.product_id, isNaN(val) ? 0 : val);
                          }}
                          testID={`qty-input-${item.product_id}`}
                        />
                        <TouchableOpacity
                          style={styles.stepperBtn}
                          onPress={() => handleUpdateQuantity(item.product_id, item.quantity + 1)}
                          accessibilityLabel={`Increase quantity for ${item.product_name}`}
                          testID={`qty-plus-${item.product_id}`}
                        >
                          <Text style={styles.stepperBtnText}>+</Text>
                        </TouchableOpacity>
                      </View>

                      {/* Expected Price Input */}
                      <View style={styles.priceContainer}>
                        <Text style={styles.priceLabel}>Price:</Text>
                        <TextInput
                          style={styles.priceInput}
                          keyboardType="numeric"
                          value={String(item.expected_price)}
                          onChangeText={(val) => handleUpdatePrice(item.product_id, val)}
                          testID={`price-input-${item.product_id}`}
                        />
                        <Text style={styles.currencyLabel}>FCFA</Text>
                      </View>

                      {/* Subtotal */}
                      <Text style={styles.itemSubtotal}>{subtotal.toLocaleString()} FCFA</Text>
                    </View>
                  </View>
                );
              })
            )}

            {/* Total Section (Number Prominence Rule) */}
            <View style={styles.totalSection}>
              <Text style={styles.totalLabel}>ESTIMATED TOTAL COST</Text>
              <Text style={styles.totalAmount} testID="draft-estimated-total">
                {estimatedTotal.toLocaleString()} FCFA
              </Text>
            </View>

            {/* Product Catalog Picker */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>SELECT PRODUCTS</Text>
            </View>

            {loadingProducts ? (
              <ActivityIndicator size="small" color="#000000" style={{ marginVertical: 16 }} />
            ) : productError ? (
              <Text style={styles.errorText}>{productError}</Text>
            ) : (
              <View style={styles.catalogGrid}>
                {products.map((prod) => {
                  const isSelected = selectedItems.some((i) => i.product_id === prod.id);
                  const numPrice =
                    typeof prod.price === 'number' ? prod.price : parseFloat(prod.price) || 0;

                  return (
                    <TouchableOpacity
                      key={prod.id}
                      style={[styles.catalogCard, isSelected && styles.catalogCardSelected]}
                      onPress={() => handleAddProduct(prod)}
                      accessibilityRole="button"
                      accessibilityLabel={`Add ${prod.name}`}
                      testID={`product-select-${prod.id}`}
                    >
                      <Text style={styles.catalogName} numberOfLines={1}>
                        {prod.name}
                      </Text>
                      <View style={styles.catalogBottomRow}>
                        <Text style={styles.catalogPrice}>{numPrice.toLocaleString()} FCFA</Text>
                        <View style={[styles.addBadge, isSelected && styles.addBadgeSelected]}>
                          <Text style={[styles.addBadgeText, isSelected && styles.addBadgeTextSelected]}>
                            {isSelected ? 'Added' : '+ Add'}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </ScrollView>

          {/* Footer Action */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[
                styles.createButton,
                (selectedItems.length === 0 || isSubmitting) && styles.createButtonDisabled,
              ]}
              onPress={handleCreateRequisition}
              disabled={selectedItems.length === 0 || isSubmitting}
              accessibilityRole="button"
              accessibilityLabel="Create Requisition"
              testID="create-requisition-btn"
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.createButtonText}>Create Requisition</Text>
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
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8E8E93',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111111',
    minHeight: 44,
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
  sectionHeader: {
    marginTop: 8,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8E8E93',
    letterSpacing: 0.5,
  },
  emptyItemsBox: {
    padding: 16,
    backgroundColor: '#F2F2F7',
    borderRadius: 16,
    marginBottom: 16,
  },
  emptyItemsText: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
  },
  itemCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  itemTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111111',
    flex: 1,
  },
  removeText: {
    fontSize: 16,
    color: '#8E8E93',
    fontWeight: '700',
    paddingLeft: 8,
  },
  itemControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
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
  qtyInput: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111111',
    width: 32,
    textAlign: 'center',
    padding: 0,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  priceLabel: {
    fontSize: 13,
    color: '#8E8E93',
  },
  priceInput: {
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 14,
    fontWeight: '600',
    color: '#111111',
    minWidth: 60,
    textAlign: 'right',
  },
  currencyLabel: {
    fontSize: 12,
    color: '#8E8E93',
  },
  itemSubtotal: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111111',
  },
  totalSection: {
    backgroundColor: '#F2F2F7',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginVertical: 14,
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8E8E93',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  totalAmount: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111111',
    letterSpacing: -0.5,
  },
  catalogGrid: {
    gap: 8,
    marginBottom: 20,
  },
  catalogCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 16,
    padding: 12,
  },
  catalogCardSelected: {
    borderColor: '#111111',
  },
  catalogName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111111',
    marginBottom: 4,
  },
  catalogBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  catalogPrice: {
    fontSize: 13,
    color: '#8E8E93',
  },
  addBadge: {
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  addBadgeSelected: {
    backgroundColor: '#000000',
  },
  addBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111111',
  },
  addBadgeTextSelected: {
    color: '#FFFFFF',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
    marginVertical: 8,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  createButton: {
    backgroundColor: '#000000',
    borderRadius: 9999,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
  },
  createButtonDisabled: {
    opacity: 0.5,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
