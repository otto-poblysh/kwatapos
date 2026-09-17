import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { getApiBaseUrl } from '../../../core/context/AuthContext';
import { useCartStore } from '../store/cartStore';

export interface CartSidebarProps {
  apiBaseUrl?: string;
  onCheckoutSuccess?: (order: any) => void;
  onCheckoutError?: (error: string) => void;
}

export function CartSidebar({
  apiBaseUrl,
  onCheckoutSuccess,
  onCheckoutError,
}: CartSidebarProps) {
  const items = useCartStore((state) => state.items);
  const addItem = useCartStore((state) => state.addItem);
  const decrementItem = useCartStore((state) => state.decrementItem);
  const removeItem = useCartStore((state) => state.removeItem);
  const clearCart = useCartStore((state) => state.clearCart);
  const totalPrice = useCartStore((state) => state.totalPrice());
  const totalItems = useCartStore((state) => state.totalItems());

  const [isCheckingOut, setIsCheckingOut] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (items.length > 0 && successMessage) {
      setSuccessMessage(null);
    }
  }, [items.length, successMessage]);

  const baseUrl = apiBaseUrl ?? getApiBaseUrl();

  const handleCheckout = async () => {
    if (items.length === 0 || isCheckingOut) return;

    setIsCheckingOut(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const payload = {
        items: items.map((i) => ({
          product_id: i.product.id,
          quantity: i.quantity,
        })),
      };

      const res = await fetch(`${baseUrl}/api/orders/cash`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.status === 201) {
        const totalFormatted = `${(data.total_amount ?? totalPrice).toLocaleString()} FCFA`;
        const successMsg = `Order completed successfully! Total: ${totalFormatted}`;
        setSuccessMessage(successMsg);
        clearCart();
        onCheckoutSuccess?.(data);
      } else {
        const errorText = data?.error || `Checkout failed (${res.status})`;
        setErrorMessage(errorText);
        onCheckoutError?.(errorText);
      }
    } catch (err: any) {
      const errorText = err?.message || 'Network error during checkout';
      setErrorMessage(errorText);
      onCheckoutError?.(errorText);
    } finally {
      setIsCheckingOut(false);
    }
  };

  const isCartEmpty = items.length === 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Current Order</Text>
        {!isCartEmpty && (
          <TouchableOpacity
            onPress={clearCart}
            accessibilityRole="button"
            accessibilityLabel="Clear cart"
            style={styles.clearButton}
          >
            <Text style={styles.clearText}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Success Banner */}
      {successMessage && (
        <View style={styles.successBanner} testID="checkout-success-banner">
          <Text style={styles.alertText}>{successMessage}</Text>
        </View>
      )}

      {/* Error Banner */}
      {errorMessage && (
        <View style={styles.errorBanner} testID="checkout-error-banner">
          <Text style={styles.alertText}>{errorMessage}</Text>
        </View>
      )}

      {/* Cart Items or Empty State */}
      {isCartEmpty ? (
        <View style={styles.emptyContainer} testID="cart-empty-state">
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptySubtitle}>
            Select products to start an order
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.itemList} showsVerticalScrollIndicator={false}>
          {items.map(({ product, quantity }) => {
            const itemSubtotal = product.price * quantity;

            return (
              <View key={product.id} style={styles.itemRow}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName} numberOfLines={1}>
                    {product.name}
                  </Text>
                  <Text style={styles.itemUnitPrice}>
                    @ {product.price.toLocaleString()} FCFA
                  </Text>
                </View>

                <View style={styles.itemControls}>
                  <View style={styles.quantityWrapper}>
                    <TouchableOpacity
                      style={styles.qtyButton}
                      onPress={() => decrementItem(product.id)}
                      testID={`cart-dec-${product.id}`}
                      accessibilityRole="button"
                      accessibilityLabel={`Decrease quantity of ${product.name}`}
                    >
                      <Text style={styles.qtyButtonText}>−</Text>
                    </TouchableOpacity>

                    <Text style={styles.qtyText}>{quantity}</Text>

                    <TouchableOpacity
                      style={styles.qtyButton}
                      onPress={() => addItem(product)}
                      testID={`cart-inc-${product.id}`}
                      accessibilityRole="button"
                      accessibilityLabel={`Increase quantity of ${product.name}`}
                    >
                      <Text style={styles.qtyButtonText}>+</Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.itemSubtotal}>
                    {itemSubtotal.toLocaleString()} FCFA
                  </Text>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Cart Summary & Checkout */}
      <View style={styles.footer}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Total Items</Text>
          <Text style={styles.summaryValue}>{totalItems}</Text>
        </View>

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>
            {totalPrice.toLocaleString()} FCFA
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.checkoutButton,
            (isCartEmpty || isCheckingOut) && styles.disabledCheckoutButton,
          ]}
          onPress={handleCheckout}
          disabled={isCartEmpty || isCheckingOut}
          accessibilityRole="button"
          accessibilityLabel="Checkout (Cash)"
        >
          {isCheckingOut ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.checkoutText}>Checkout (Cash)</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    padding: 24,
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111111',
  },
  clearButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
  },
  successBanner: {
    backgroundColor: '#34C759',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },
  errorBanner: {
    backgroundColor: '#FF3B30',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },
  alertText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
  },
  itemList: {
    flex: 1,
    marginVertical: 8,
  },
  itemRow: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  itemInfo: {
    marginBottom: 8,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111111',
  },
  itemUnitPrice: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 2,
  },
  itemControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quantityWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 9999,
    paddingHorizontal: 4,
  },
  qtyButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111111',
  },
  qtyText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111111',
    minWidth: 24,
    textAlign: 'center',
  },
  itemSubtotal: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111111',
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    paddingTop: 16,
    marginTop: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 14,
    color: '#111111',
    fontWeight: '700',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 20,
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 16,
    color: '#8E8E93',
    fontWeight: '600',
  },
  totalValue: {
    fontSize: 32,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: -1,
  },
  checkoutButton: {
    backgroundColor: '#000000',
    borderRadius: 9999,
    paddingVertical: 16,
    paddingHorizontal: 24,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledCheckoutButton: {
    backgroundColor: '#E5E5EA',
  },
  checkoutText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
