import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getApiBaseUrl } from '../../../core/context/AuthContext';
import { useCartStore, CartItem } from '../../../features/sales/store/cartStore';
import { ProductGrid } from '../../../features/sales/components/ProductGrid';
import { CartSidebar } from '../../../features/sales/components/CartSidebar';

export interface OrderItemDetail {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number | string;
  subtotal: number | string;
  created_at: string;
}

export interface OrderDetail {
  id: string;
  order_name: string | null;
  payment_method: string | null;
  total_amount: number | string;
  status: string;
  items: OrderItemDetail[];
  created_at: string;
  updated_at: string;
}

export default function TabDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();

  const setActiveOrder = useCartStore((state) => state.setActiveOrder);
  const clearActiveOrder = useCartStore((state) => state.clearActiveOrder);
  const totalItems = useCartStore((state) => state.totalItems());
  const totalPrice = useCartStore((state) => state.totalPrice());

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'products' | 'cart'>('products');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const baseUrl = getApiBaseUrl();

  const fetchTabDetails = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`${baseUrl}/api/orders/${id}`);
      if (!res.ok) {
        throw new Error(`Failed to load tab (${res.status})`);
      }
      const data: OrderDetail = await res.json();
      setOrder(data);

      const mappedItems: CartItem[] = (data.items || []).map((item) => ({
        product: {
          id: item.product_id,
          name: item.product_name,
          price:
            typeof item.unit_price === 'string'
              ? parseFloat(item.unit_price)
              : Number(item.unit_price),
          category: 'General',
        },
        quantity: item.quantity,
      }));

      setActiveOrder(data.id, data.order_name, mappedItems);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch tab details');
    } finally {
      setIsLoading(false);
    }
  }, [id, baseUrl, setActiveOrder]);

  useEffect(() => {
    fetchTabDetails();

    return () => {
      clearActiveOrder();
    };
  }, [fetchTabDetails, clearActiveOrder]);

  const handleBack = () => {
    router.push('/(sales)');
  };

  const handleSaveTab = useCallback(async () => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  const handleSettleTab = useCallback(() => {
    // Settle tab action hook (used in subsequent checkout & settlement phases)
  }, []);

  const isWide = width >= 768;

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#000000" testID="tab-loading" />
      </SafeAreaView>
    );
  }

  if (error || !order) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Text style={styles.errorText}>{error || 'Tab not found'}</Text>
        <TouchableOpacity
          style={styles.backPillButton}
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel="← Open Orders"
        >
          <Text style={styles.backPillButtonText}>← Open Orders</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Tab Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBack}
            accessibilityRole="button"
            accessibilityLabel="← Open Orders"
          >
            <Text style={styles.backButtonText}>← Open Orders</Text>
          </TouchableOpacity>

          <View style={styles.titleRow}>
            <Text style={styles.title}>{order.order_name || 'Unnamed Tab'}</Text>
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>
                {order.status?.toUpperCase() || 'OPEN'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.headerRight}>
          <View style={styles.totalDisplay}>
            <Text style={styles.totalLabel}>Tab Total</Text>
            <Text style={styles.totalAmount}>
              {totalPrice.toLocaleString()} FCFA
            </Text>
          </View>
        </View>
      </View>

      {/* Mobile Tab Switcher (< 768px) */}
      {!isWide && (
        <View style={styles.mobileTabs}>
          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === 'products' && styles.activeTabButton,
            ]}
            onPress={() => setActiveTab('products')}
            accessibilityRole="tab"
            accessibilityLabel="Products"
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'products' && styles.activeTabText,
              ]}
            >
              Products
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === 'cart' && styles.activeTabButton,
            ]}
            onPress={() => setActiveTab('cart')}
            accessibilityRole="tab"
            accessibilityLabel={`Cart (${totalItems})`}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'cart' && styles.activeTabText,
              ]}
            >
              Cart ({totalItems})
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Main Workspace Layout */}
      {isWide ? (
        <View style={styles.wideLayout}>
          <View style={styles.gridSection}>
            <ProductGrid refreshTrigger={refreshTrigger} />
          </View>
          <View style={styles.cartSection}>
            <CartSidebar
              mode="tab"
              apiBaseUrl={baseUrl}
              onSaveTab={handleSaveTab}
              onSettleTab={handleSettleTab}
            />
          </View>
        </View>
      ) : (
        <View style={styles.mobileLayout}>
          <View
            style={[
              styles.mobileGridContainer,
              activeTab !== 'products' && styles.hiddenView,
            ]}
          >
            <ProductGrid refreshTrigger={refreshTrigger} />
            {totalItems > 0 && (
              <TouchableOpacity
                style={styles.floatingCartBar}
                onPress={() => setActiveTab('cart')}
                accessibilityRole="button"
                accessibilityLabel={`View Cart: ${totalItems} ${
                  totalItems === 1 ? 'item' : 'items'
                }, ${totalPrice.toLocaleString()} FCFA`}
              >
                <Text style={styles.floatingCartText}>
                  {totalItems} {totalItems === 1 ? 'item' : 'items'} •{' '}
                  {totalPrice.toLocaleString()} FCFA
                </Text>
                <Text style={styles.floatingCartAction}>View Cart →</Text>
              </TouchableOpacity>
            )}
          </View>

          <View
            style={[
              styles.mobileCartContainer,
              activeTab !== 'cart' && styles.hiddenView,
            ]}
          >
            <CartSidebar
              mode="tab"
              apiBaseUrl={baseUrl}
              onSaveTab={handleSaveTab}
              onSettleTab={handleSettleTab}
            />
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  backPillButton: {
    backgroundColor: '#000000',
    borderRadius: 9999,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  backPillButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
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
    flex: 1,
  },
  backButton: {
    paddingVertical: 4,
    paddingRight: 12,
    marginBottom: 4,
    minHeight: 32,
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '600',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111111',
    letterSpacing: -0.5,
  },
  statusBadge: {
    backgroundColor: '#E4F9E8',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
  },
  statusText: {
    color: '#1C1C1E',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  totalDisplay: {
    alignItems: 'flex-end',
  },
  totalLabel: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '600',
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: -0.5,
  },
  mobileTabs: {
    flexDirection: 'row',
    backgroundColor: '#E5E5EA',
    borderRadius: 9999,
    padding: 4,
    marginHorizontal: 16,
    marginVertical: 10,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  activeTabButton: {
    backgroundColor: '#000000',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#8E8E93',
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  wideLayout: {
    flex: 1,
    flexDirection: 'row',
    padding: 16,
    gap: 16,
  },
  gridSection: {
    flex: 2,
  },
  cartSection: {
    flex: 1,
    maxWidth: 420,
    minWidth: 320,
  },
  mobileLayout: {
    flex: 1,
  },
  mobileGridContainer: {
    flex: 1,
    position: 'relative',
  },
  mobileCartContainer: {
    flex: 1,
    padding: 12,
  },
  hiddenView: {
    display: 'none',
  },
  floatingCartBar: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: '#000000',
    borderRadius: 9999,
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  floatingCartText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  floatingCartAction: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
