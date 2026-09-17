import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Modal,
  TextInput,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../core/hooks/useAuth';
import { getApiBaseUrl } from '../../core/context/AuthContext';

export interface OpenOrder {
  id: string;
  order_name: string | null;
  payment_method: string | null;
  total_amount: number | string;
  status: string;
  items_count: number;
  created_at: string;
  updated_at: string;
}

export default function SalesDashboard() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();

  const [orders, setOrders] = useState<OpenOrder[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [isNewTabModalVisible, setIsNewTabModalVisible] = useState<boolean>(false);
  const [newTabName, setNewTabName] = useState<string>('');
  const [isCreatingTab, setIsCreatingTab] = useState<boolean>(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const baseUrl = getApiBaseUrl();

  const fetchOpenOrders = useCallback(async (isPullToRefresh = false) => {
    if (isPullToRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      const res = await fetch(`${baseUrl}/api/orders`);
      if (!res.ok) {
        throw new Error(`Failed to load open orders (${res.status})`);
      }
      const data = await res.json();
      setOrders(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch open orders');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [baseUrl]);

  useEffect(() => {
    fetchOpenOrders();
  }, [fetchOpenOrders]);

  const handleOpenNewTabModal = () => {
    setNewTabName('');
    setCreateError(null);
    setIsNewTabModalVisible(true);
  };

  const handleCloseNewTabModal = () => {
    if (isCreatingTab) return;
    setIsNewTabModalVisible(false);
    setNewTabName('');
    setCreateError(null);
  };

  const handleCreateTab = async () => {
    setIsCreatingTab(true);
    setCreateError(null);

    try {
      const trimmedName = newTabName.trim();
      const payload = trimmedName ? { order_name: trimmedName } : {};

      const res = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.status === 201 && data?.id) {
        setIsNewTabModalVisible(false);
        setNewTabName('');
        router.push(`/(sales)/tab/${data.id}`);
      } else {
        setCreateError(data?.error || `Failed to create tab (${res.status})`);
      }
    } catch (err: any) {
      setCreateError(err?.message || 'Network error while creating tab');
    } finally {
      setIsCreatingTab(false);
    }
  };

  const handleOpenTab = (orderId: string) => {
    router.push(`/(sales)/tab/${orderId}`);
  };

  const formatCurrency = (amount: number | string) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : Number(amount);
    return `${(isNaN(num) ? 0 : num).toLocaleString()} FCFA`;
  };

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const isWide = width >= 768;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Active Tabs</Text>
            <View style={styles.tabCountBadge}>
              <Text style={styles.tabCountText}>{orders.length}</Text>
            </View>
          </View>
          <View style={styles.userRow}>
            <Text style={styles.subtitle}>Sales Dashboard</Text>
            <Text style={styles.userEmail}>{user?.email ?? 'Unknown'}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>{user?.role ?? 'sales'}</Text>
            </View>
          </View>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.newTabButton}
            onPress={handleOpenNewTabModal}
            accessibilityRole="button"
            accessibilityLabel="+ New Tab"
          >
            <Text style={styles.newTabText}>+ New Tab</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.logoutButton}
            onPress={logout}
            accessibilityRole="button"
            accessibilityLabel="Log Out"
          >
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content */}
      {isLoading ? (
        <View style={styles.loadingContainer} testID="orders-loading">
          <ActivityIndicator size="large" color="#000000" />
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => fetchOpenOrders(false)}
            accessibilityRole="button"
            accessibilityLabel="Retry"
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : orders.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.emptyContainer}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => fetchOpenOrders(true)}
              tintColor="#000000"
            />
          }
        >
          <View style={styles.emptyCard} testID="empty-orders-state">
            <Text style={styles.emptyTitle}>No Open Tabs</Text>
            <Text style={styles.emptySubtitle}>
              No open tabs. Tap '+ New Tab' to start an order.
            </Text>
            <TouchableOpacity
              style={styles.emptyNewTabButton}
              onPress={handleOpenNewTabModal}
              accessibilityRole="button"
              accessibilityLabel="+ New Tab"
            >
              <Text style={styles.emptyNewTabText}>+ New Tab</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => fetchOpenOrders(true)}
              tintColor="#000000"
            />
          }
        >
          <View style={[styles.gridContainer, isWide && styles.gridWide]}>
            {orders.map((order) => {
              const itemCount = order.items_count ?? 0;
              const itemCountLabel = `${itemCount} ${itemCount === 1 ? 'item' : 'items'}`;

              return (
                <TouchableOpacity
                  key={order.id}
                  style={[styles.card, isWide && styles.cardWide]}
                  onPress={() => handleOpenTab(order.id)}
                  testID={`tab-card-${order.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Tab ${order.order_name || 'Unnamed Tab'}, total ${formatCurrency(order.total_amount)}`}
                  activeOpacity={0.7}
                >
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle} numberOfLines={1}>
                      {order.order_name || 'Unnamed Tab'}
                    </Text>
                    <View style={styles.statusBadge}>
                      <Text style={styles.statusText}>
                        {order.status?.toUpperCase() || 'OPEN'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.cardTotalContainer}>
                    <Text style={styles.cardTotalLabel}>Total</Text>
                    <Text style={styles.cardTotalAmount}>
                      {formatCurrency(order.total_amount)}
                    </Text>
                  </View>

                  <View style={styles.cardFooter}>
                    <View style={styles.itemCountBadge}>
                      <Text style={styles.itemCountText}>{itemCountLabel}</Text>
                    </View>
                    {Boolean(order.updated_at || order.created_at) && (
                      <Text style={styles.cardTimeText}>
                        {formatTime(order.updated_at || order.created_at)}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      )}

      {/* New Tab Modal */}
      <Modal
        visible={isNewTabModalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCloseNewTabModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>New Tab</Text>
            <Text style={styles.modalSubtitle}>
              Enter a name or identifier for this tab (e.g. Table 4, Bar 2).
            </Text>

            {createError && (
              <View style={styles.modalErrorBanner}>
                <Text style={styles.modalErrorText}>{createError}</Text>
              </View>
            )}

            <TextInput
              style={styles.modalInput}
              placeholder="Enter tab name (e.g. Table 4)"
              placeholderTextColor="#8E8E93"
              value={newTabName}
              onChangeText={setNewTabName}
              autoFocus
              testID="new-tab-input"
              accessibilityLabel="Enter tab name (e.g. Table 4)"
            />

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={handleCloseNewTabModal}
                disabled={isCreatingTab}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalCreateButton,
                  isCreatingTab && styles.disabledButton,
                ]}
                onPress={handleCreateTab}
                disabled={isCreatingTab}
                accessibilityRole="button"
                accessibilityLabel="Create Tab"
              >
                {isCreatingTab ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalCreateText}>Create Tab</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  tabCountBadge: {
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 9999,
  },
  tabCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111111',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    flexWrap: 'wrap',
    gap: 6,
  },
  subtitle: {
    fontSize: 13,
    color: '#8E8E93',
    fontWeight: '600',
    marginRight: 6,
  },
  userEmail: {
    fontSize: 13,
    color: '#8E8E93',
    fontWeight: '600',
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
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  newTabButton: {
    backgroundColor: '#000000',
    borderRadius: 9999,
    paddingVertical: 10,
    paddingHorizontal: 18,
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  newTabText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  logoutButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 9999,
    paddingVertical: 10,
    paddingHorizontal: 16,
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutText: {
    color: '#111111',
    fontSize: 14,
    fontWeight: '700',
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
  gridContainer: {
    flexDirection: 'column',
    gap: 16,
  },
  gridWide: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    padding: 20,
    minHeight: 140,
    justifyContent: 'space-between',
  },
  cardWide: {
    width: '31.5%',
    minWidth: 260,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111111',
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    backgroundColor: '#E4F9E8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  statusText: {
    color: '#1C1C1E',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  cardTotalContainer: {
    marginVertical: 4,
  },
  cardTotalLabel: {
    fontSize: 13,
    color: '#8E8E93',
    fontWeight: '600',
    marginBottom: 2,
  },
  cardTotalAmount: {
    fontSize: 26,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: -0.5,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
  },
  itemCountBadge: {
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
  },
  itemCountText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111111',
  },
  cardTimeText: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '500',
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
    fontWeight: '700',
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
  emptyNewTabButton: {
    backgroundColor: '#000000',
    borderRadius: 9999,
    paddingVertical: 14,
    paddingHorizontal: 24,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyNewTabText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    padding: 24,
    width: '100%',
    maxWidth: 440,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111111',
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 16,
    lineHeight: 20,
  },
  modalErrorBanner: {
    backgroundColor: '#FF3B30',
    borderRadius: 12,
    padding: 10,
    marginBottom: 14,
  },
  modalErrorText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  modalInput: {
    backgroundColor: '#F2F2F7',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#111111',
    minHeight: 50,
    marginBottom: 20,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalCancelButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 9999,
    paddingVertical: 12,
    paddingHorizontal: 20,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#111111',
    fontSize: 14,
    fontWeight: '700',
  },
  modalCreateButton: {
    backgroundColor: '#000000',
    borderRadius: 9999,
    paddingVertical: 12,
    paddingHorizontal: 22,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCreateText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  disabledButton: {
    backgroundColor: '#E5E5EA',
  },
});

