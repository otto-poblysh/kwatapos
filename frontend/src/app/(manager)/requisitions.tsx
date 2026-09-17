import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { getApiBaseUrl } from '../../core/context/AuthContext';
import { RequisitionDraftModal } from '../../features/requisitions/components/RequisitionDraftModal';
import { DeliveryModal } from '../../features/requisitions/components/DeliveryModal';
import {
  RequisitionSummary,
  RequisitionDetail,
  RequisitionStatus,
} from '../../features/requisitions/types';

export interface RequisitionsScreenProps {
  apiBaseUrl?: string;
}

export default function RequisitionsScreen({ apiBaseUrl }: RequisitionsScreenProps) {
  const router = useRouter();
  const baseUrl = apiBaseUrl ?? getApiBaseUrl();

  const [requisitions, setRequisitions] = useState<RequisitionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [draftModalVisible, setDraftModalVisible] = useState(false);
  const [deliveryModalVisible, setDeliveryModalVisible] = useState(false);
  const [activeDeliveryRequisition, setActiveDeliveryRequisition] =
    useState<RequisitionDetail | null>(null);

  // Expanded card details map (requisition id -> RequisitionDetail)
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailsCache, setDetailsCache] = useState<Record<string, RequisitionDetail>>({});
  const [loadingDetails, setLoadingDetails] = useState<Record<string, boolean>>({});

  // Toast / feedback message
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = React.useRef<any>(null);

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
    }, 3000);
  };

  const fetchRequisitions = useCallback(async () => {
    setLoading(true);
    setError(null);
    setDetailsCache({});
    try {
      const res = await fetch(`${baseUrl}/api/requisitions`);
      if (!res.ok) {
        throw new Error(`Failed to load requisitions (${res.status})`);
      }
      const data: RequisitionSummary[] = await res.json();
      setRequisitions(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || 'Error fetching requisitions');
    } finally {
      setLoading(false);
    }
  }, [baseUrl]);

  useEffect(() => {
    fetchRequisitions();
  }, [fetchRequisitions]);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.push('/(manager)');
    }
  };

  const handleToggleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }

    setExpandedId(id);
    if (!detailsCache[id]) {
      setLoadingDetails((prev) => ({ ...prev, [id]: true }));
      try {
        const res = await fetch(`${baseUrl}/api/requisitions/${id}`);
        if (res.ok) {
          const detail: RequisitionDetail = await res.json();
          setDetailsCache((prev) => ({ ...prev, [id]: detail }));
        }
      } catch {
        // detail fetch fail silent fallback
      } finally {
        setLoadingDetails((prev) => ({ ...prev, [id]: false }));
      }
    }
  };

  const handleShare = async (req: RequisitionSummary) => {
    try {
      const res = await fetch(`${baseUrl}/api/requisitions/${req.id}/share`, {
        method: 'POST',
      });
      const data = await res.json().catch(() => ({}));
      const effectiveToken = data.token || req.token;
      const vendorUrl = `http://127.0.0.1:3011/public/vendor/${effectiveToken}`;

      if (Platform.OS === 'web') {
        if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(vendorUrl);
        }
        showToast('Vendor link copied to clipboard!');
      } else {
        await Share.share({
          message: `Please confirm order prices for Kwata POS: ${vendorUrl}`,
          url: vendorUrl,
        });
      }

      fetchRequisitions();
    } catch (err: any) {
      showToast('Error sharing requisition.');
    }
  };

  const handleOpenDelivery = async (req: RequisitionSummary) => {
    // If we have details cached, pass them, otherwise fetch
    if (detailsCache[req.id]) {
      setActiveDeliveryRequisition(detailsCache[req.id]);
    } else {
      try {
        const res = await fetch(`${baseUrl}/api/requisitions/${req.id}`);
        if (res.ok) {
          const detail: RequisitionDetail = await res.json();
          setDetailsCache((prev) => ({ ...prev, [req.id]: detail }));
          setActiveDeliveryRequisition(detail);
        } else {
          setActiveDeliveryRequisition({
            id: req.id,
            token: req.token,
            title: req.title,
            status: req.status,
            items: [],
          });
        }
      } catch {
        setActiveDeliveryRequisition({
          id: req.id,
          token: req.token,
          title: req.title,
          status: req.status,
          items: [],
        });
      }
    }
    setDeliveryModalVisible(true);
  };

  const handlePay = async (id: string) => {
    try {
      const res = await fetch(`${baseUrl}/api/requisitions/${id}/pay`, {
        method: 'POST',
      });
      if (res.ok) {
        showToast('Requisition marked as paid.');
        fetchRequisitions();
      } else {
        showToast('Failed to mark requisition as paid.');
      }
    } catch {
      showToast('Error marking requisition as paid.');
    }
  };

  const getStatusBadgeStyle = (status: RequisitionStatus | string) => {
    switch (status) {
      case 'accepted':
      case 'delivered':
      case 'paid':
        return styles.badgeSuccess;
      case 'partial_delivery':
        return styles.badgeWarning;
      case 'sent':
        return styles.badgeSent;
      case 'draft':
      default:
        return styles.badgeDraft;
    }
  };

  const getStatusTextStyle = (status: RequisitionStatus | string) => {
    switch (status) {
      case 'accepted':
      case 'delivered':
      case 'paid':
        return styles.badgeTextSuccess;
      case 'partial_delivery':
        return styles.badgeTextWarning;
      case 'sent':
        return styles.badgeTextSent;
      case 'draft':
      default:
        return styles.badgeTextDraft;
    }
  };

  const formatStatus = (status: string) => {
    switch (status) {
      case 'partial_delivery':
        return 'Partial Delivery';
      default:
        return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header adhering to DESIGN.md */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel="Back to Dashboard"
          testID="requisitions-back-btn"
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Requisitions</Text>
        <TouchableOpacity
          style={styles.headerDraftButton}
          onPress={() => setDraftModalVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Draft New Requisition"
          testID="draft-new-requisition-btn"
        >
          <Text style={styles.headerDraftButtonText}>+ Draft</Text>
        </TouchableOpacity>
      </View>

      {/* Toast Notification */}
      {toastMessage && (
        <View style={styles.toastContainer} testID="clipboard-toast">
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#000000" testID="requisitions-loading" />
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchRequisitions}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : requisitions.length === 0 ? (
        <ScrollView contentContainerStyle={styles.emptyContainer}>
          <View style={styles.emptyCard} testID="requisitions-empty-state">
            <View style={styles.iconContainer}>
              <Text style={styles.iconText}>📦</Text>
            </View>
            <Text style={styles.emptyTitle}>Your vendor orders will appear here.</Text>
            <Text style={styles.emptySubtitle}>
              Generate orders and share them directly to your vendors on WhatsApp.
            </Text>
            <TouchableOpacity
              style={styles.draftButton}
              onPress={() => setDraftModalVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="Draft First Requisition"
              testID="draft-first-requisition-btn"
            >
              <Text style={styles.draftButtonText}>Draft First Requisition</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.listContainer}>
          {requisitions.map((req) => {
            const isExpanded = expandedId === req.id;
            const detail = detailsCache[req.id];
            const isLoadingDetail = loadingDetails[req.id];
            const itemCount = req.item_count ?? req.items_count ?? detail?.items?.length ?? 0;
            const totalVal = Number(req.total_estimated_cost ?? req.total_amount ?? 0);

            return (
              <View
                key={req.id}
                style={styles.card}
                testID={`requisition-card-${req.id}`}
              >
                {/* Top row: Title and Status Badge */}
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderLeft}>
                    <Text style={styles.cardTitle}>{req.title}</Text>
                    <Text style={styles.cardMeta}>
                      {itemCount} item{itemCount !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  <View
                    style={[styles.badge, getStatusBadgeStyle(req.status)]}
                    testID={`status-badge-${req.id}`}
                  >
                    <Text style={[styles.badgeText, getStatusTextStyle(req.status)]}>
                      {formatStatus(req.status)}
                    </Text>
                  </View>
                </View>

                {/* Prominent Amount (Number Prominence Rule) */}
                <View style={styles.cardAmountRow}>
                  <View>
                    <Text style={styles.amountLabel}>ESTIMATED / CONFIRMED TOTAL</Text>
                    <Text style={styles.amountValue}>
                      {totalVal.toLocaleString()} FCFA
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.expandToggle}
                    onPress={() => handleToggleExpand(req.id)}
                    accessibilityRole="button"
                    accessibilityLabel={isExpanded ? 'Hide Items' : 'View Items'}
                    testID={`expand-btn-${req.id}`}
                  >
                    <Text style={styles.expandToggleText}>
                      {isExpanded ? 'Hide Items ▲' : 'View Items ▼'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Expandable Line Items */}
                {isExpanded && (
                  <View style={styles.expandedSection} testID={`expanded-items-${req.id}`}>
                    <Text style={styles.expandedSectionTitle}>ORDER ITEMS</Text>
                    {isLoadingDetail ? (
                      <ActivityIndicator size="small" color="#000000" style={{ marginVertical: 8 }} />
                    ) : detail?.items && detail.items.length > 0 ? (
                      <View style={styles.itemsTable}>
                        {detail.items.map((item) => {
                          const expPrice = Number(item.expected_price || 0);
                          const confPrice =
                            item.confirmed_price !== null && item.confirmed_price !== undefined
                              ? Number(item.confirmed_price)
                              : null;

                          return (
                            <View key={item.id} style={styles.itemRow} testID={`item-row-${item.id}`}>
                              <View style={styles.itemRowLeft}>
                                <Text style={styles.itemRowName}>
                                  {item.product_name || 'Product'}
                                </Text>
                                <Text style={styles.itemRowSub}>
                                  Qty: {item.quantity} • Expected: {expPrice.toLocaleString()} FCFA
                                </Text>
                              </View>
                              <View style={styles.itemRowRight}>
                                <Text style={styles.itemRowConfirmed}>
                                  {confPrice !== null
                                    ? `Confirmed: ${confPrice.toLocaleString()} FCFA`
                                    : 'Price Pending'}
                                </Text>
                                <Text style={styles.itemRowReceived}>
                                  {item.received_quantity !== null && item.received_quantity !== undefined
                                    ? `Received: ${item.received_quantity} / ${item.quantity}`
                                    : 'Delivery Pending'}
                                </Text>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    ) : (
                      <Text style={styles.noItemsText}>No item details available.</Text>
                    )}
                  </View>
                )}

                {/* Status-specific Action Button */}
                <View style={styles.cardActionsRow}>
                  {req.status === 'draft' && (
                    <TouchableOpacity
                      style={styles.actionButtonPrimary}
                      onPress={() => handleShare(req)}
                      accessibilityRole="button"
                      accessibilityLabel="Share to Vendor"
                      testID="share-requisition-btn"
                    >
                      <Text style={styles.actionButtonPrimaryText}>Share to Vendor</Text>
                    </TouchableOpacity>
                  )}

                  {req.status === 'accepted' && (
                    <TouchableOpacity
                      style={styles.actionButtonPrimary}
                      onPress={() => handleOpenDelivery(req)}
                      accessibilityRole="button"
                      accessibilityLabel="Receive Delivery"
                      testID="receive-delivery-btn"
                    >
                      <Text style={styles.actionButtonPrimaryText}>Receive Delivery</Text>
                    </TouchableOpacity>
                  )}

                  {(req.status === 'delivered' || req.status === 'partial_delivery') && (
                    <TouchableOpacity
                      style={styles.actionButtonPrimary}
                      onPress={() => handlePay(req.id)}
                      accessibilityRole="button"
                      accessibilityLabel="Mark as Paid"
                      testID="mark-paid-btn"
                    >
                      <Text style={styles.actionButtonPrimaryText}>Mark as Paid</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Modals */}
      <RequisitionDraftModal
        visible={draftModalVisible}
        onClose={() => setDraftModalVisible(false)}
        onSuccess={() => fetchRequisitions()}
        apiBaseUrl={baseUrl}
      />

      <DeliveryModal
        visible={deliveryModalVisible}
        requisitionId={activeDeliveryRequisition?.id || null}
        requisition={activeDeliveryRequisition}
        onClose={() => {
          setDeliveryModalVisible(false);
          setActiveDeliveryRequisition(null);
        }}
        onSuccess={() => fetchRequisitions()}
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
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 9999,
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111111',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111111',
    letterSpacing: -0.3,
  },
  headerDraftButton: {
    backgroundColor: '#000000',
    borderRadius: 9999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerDraftButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  toastContainer: {
    backgroundColor: '#111111',
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
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
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#000000',
    borderRadius: 9999,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  emptyContainer: {
    flexGrow: 1,
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
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  iconText: {
    fontSize: 28,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111111',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 26,
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 22,
  },
  draftButton: {
    backgroundColor: '#000000',
    borderRadius: 9999,
    paddingVertical: 16,
    paddingHorizontal: 24,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  draftButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  listContainer: {
    padding: 16,
    gap: 16,
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
    marginRight: 10,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 4,
  },
  cardMeta: {
    fontSize: 13,
    color: '#8E8E93',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  badgeDraft: {
    backgroundColor: '#F2F2F7',
  },
  badgeTextDraft: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8E93',
  },
  badgeSent: {
    backgroundColor: '#E5F0FF',
  },
  badgeTextSent: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0066CC',
  },
  badgeWarning: {
    backgroundColor: '#FFF3E0',
  },
  badgeTextWarning: {
    fontSize: 12,
    fontWeight: '600',
    color: '#E65100',
  },
  badgeSuccess: {
    backgroundColor: '#E8F8EE',
  },
  badgeTextSuccess: {
    fontSize: 12,
    fontWeight: '700',
    color: '#34C759',
  },
  cardAmountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 16,
    backgroundColor: '#F2F2F7',
    borderRadius: 16,
    padding: 14,
  },
  amountLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8E8E93',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  amountValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: -0.5,
  },
  expandToggle: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  expandToggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111111',
  },
  expandedSection: {
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    paddingTop: 14,
    marginBottom: 16,
  },
  expandedSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8E8E93',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  itemsTable: {
    gap: 10,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F9F9FB',
    borderRadius: 12,
    padding: 10,
  },
  itemRowLeft: {
    flex: 1,
    marginRight: 8,
  },
  itemRowName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 2,
  },
  itemRowSub: {
    fontSize: 12,
    color: '#8E8E93',
  },
  itemRowRight: {
    alignItems: 'flex-end',
  },
  itemRowConfirmed: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 2,
  },
  itemRowReceived: {
    fontSize: 12,
    color: '#8E8E93',
  },
  noItemsText: {
    fontSize: 13,
    color: '#8E8E93',
    textAlign: 'center',
    paddingVertical: 8,
  },
  cardActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  actionButtonPrimary: {
    backgroundColor: '#000000',
    borderRadius: 9999,
    paddingHorizontal: 20,
    paddingVertical: 12,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonPrimaryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
