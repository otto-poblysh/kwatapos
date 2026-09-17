import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../core/hooks/useAuth';
import { useCartStore } from '../../features/sales/store/cartStore';
import { ProductGrid } from '../../features/sales/components/ProductGrid';
import { CartSidebar } from '../../features/sales/components/CartSidebar';

export default function SalesDashboard() {
  const { user, logout } = useAuth();
  const { width } = useWindowDimensions();
  const [activeTab, setActiveTab] = useState<'products' | 'cart'>('products');

  const totalItems = useCartStore((state) => state.totalItems());
  const totalPrice = useCartStore((state) => state.totalPrice());

  const isWide = width >= 768;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Sales Dashboard</Text>
          <View style={styles.userRow}>
            <Text style={styles.userEmail}>{user?.email ?? 'Unknown'}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>{user?.role ?? 'sales'}</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={logout}
          accessibilityRole="button"
          accessibilityLabel="Log Out"
        >
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </View>

      {/* Mobile Tab Switcher (hidden on wide tablet/desktop) */}
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

      {/* Main Content Area */}
      {isWide ? (
        <View style={styles.wideLayout}>
          <View style={styles.gridSection}>
            <ProductGrid />
          </View>
          <View style={styles.cartSection}>
            <CartSidebar />
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
            <ProductGrid />
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
            <CartSidebar />
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
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111111',
    letterSpacing: -0.5,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  userEmail: {
    fontSize: 13,
    color: '#8E8E93',
    fontWeight: '600',
    marginRight: 8,
  },
  roleBadge: {
    backgroundColor: '#E4F9E8',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  roleText: {
    color: '#1C1C1E',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  logoutButton: {
    backgroundColor: '#000000',
    borderRadius: 9999,
    paddingVertical: 10,
    paddingHorizontal: 18,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
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
