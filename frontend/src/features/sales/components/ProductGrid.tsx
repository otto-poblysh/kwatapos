import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  useWindowDimensions,
} from 'react-native';
import { getApiBaseUrl } from '../../../core/context/AuthContext';
import { Product, useCartStore } from '../store/cartStore';

export interface ProductGridProps {
  apiBaseUrl?: string;
  initialProducts?: Product[];
  onAddToCart?: (product: Product) => void;
  refreshTrigger?: number;
}

export function ProductGrid({
  apiBaseUrl,
  initialProducts,
  onAddToCart,
  refreshTrigger,
}: ProductGridProps) {
  const [products, setProducts] = useState<Product[]>(initialProducts ?? []);
  const [loading, setLoading] = useState<boolean>(!initialProducts);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef<boolean>(true);

  const addItemToCart = useCartStore((state) => state.addItem);
  const handleAddToCart = onAddToCart ?? addItemToCart;

  const { width } = useWindowDimensions();
  const numColumns = width >= 900 ? 3 : width >= 500 ? 2 : 1;

  const baseUrl = apiBaseUrl ?? getApiBaseUrl();

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${baseUrl}/api/products`);
      if (!res.ok) {
        throw new Error(`Failed to fetch products (${res.status})`);
      }
      const data = await res.json();
      if (isMountedRef.current) {
        setProducts(data);
      }
    } catch (err: any) {
      if (isMountedRef.current) {
        setError(err?.message || 'Failed to load products');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [baseUrl]);

  useEffect(() => {
    if (!initialProducts) {
      fetchProducts();
    }
  }, [fetchProducts, initialProducts, refreshTrigger]);

  if (loading) {
    return (
      <View style={styles.centerContainer} testID="product-grid-loading">
        <ActivityIndicator size="large" color="#000000" />
        <Text style={styles.loadingText}>Loading products...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer} testID="product-grid-error">
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={fetchProducts}
          accessibilityRole="button"
          accessibilityLabel="Retry"
        >
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (products.length === 0) {
    return (
      <View style={styles.centerContainer} testID="product-grid-empty">
        <Text style={styles.emptyText}>No products available</Text>
      </View>
    );
  }

  return (
    <FlatList
      key={`grid-${numColumns}`}
      data={products}
      keyExtractor={(item) => item.id}
      numColumns={numColumns}
      contentContainerStyle={styles.listContent}
      renderItem={({ item }) => {
        const isOutOfStock = typeof item.quantity === 'number' && item.quantity <= 0;

        return (
          <View style={[styles.cardWrapper, { width: `${100 / numColumns}%` }]}>
            <View style={styles.card}>
              <View style={styles.tagRow}>
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryText}>{item.category}</Text>
                </View>
                {typeof item.quantity === 'number' && (
                  <Text
                    style={[
                      styles.stockText,
                      isOutOfStock && styles.outOfStockText,
                    ]}
                  >
                    {isOutOfStock ? 'Out of stock' : `${item.quantity} in stock`}
                  </Text>
                )}
              </View>

              <Text style={styles.productName} numberOfLines={2}>
                {item.name}
              </Text>

              <View style={styles.footerRow}>
                <Text style={styles.priceText}>
                  {item.price.toLocaleString()} FCFA
                </Text>

                <TouchableOpacity
                  style={[
                    styles.addButton,
                    isOutOfStock && styles.disabledButton,
                  ]}
                  onPress={() => {
                    if (!isOutOfStock) {
                      handleAddToCart(item);
                    }
                  }}
                  disabled={isOutOfStock}
                  testID={`product-add-${item.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Add ${item.name} to cart`}
                >
                  <Text
                    style={[
                      styles.addButtonText,
                      isOutOfStock && styles.disabledButtonText,
                    ]}
                  >
                    {isOutOfStock ? 'Unavailable' : 'Add'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  listContent: {
    padding: 8,
  },
  cardWrapper: {
    padding: 8,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    padding: 20,
    minHeight: 160,
    justifyContent: 'space-between',
  },
  tagRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryBadge: {
    backgroundColor: '#F2F2F7',
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
  },
  stockText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#8E8E93',
  },
  outOfStockText: {
    color: '#FF3B30',
    fontWeight: '700',
  },
  productName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111111',
    lineHeight: 22,
    marginBottom: 16,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  priceText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111111',
    letterSpacing: -0.5,
  },
  addButton: {
    backgroundColor: '#000000',
    borderRadius: 9999,
    paddingVertical: 12,
    paddingHorizontal: 20,
    minHeight: 44,
    minWidth: 70,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  disabledButton: {
    backgroundColor: '#E5E5EA',
  },
  disabledButtonText: {
    color: '#8E8E93',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    minHeight: 250,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#8E8E93',
    fontWeight: '500',
  },
  errorText: {
    fontSize: 15,
    color: '#FF3B30',
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
  retryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 16,
    color: '#8E8E93',
    fontWeight: '500',
  },
});
