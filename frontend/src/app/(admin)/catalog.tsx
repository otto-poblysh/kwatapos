import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { getApiBaseUrl, useAuth } from '../../core/hooks/useAuth';

interface AdminProduct {
  id: string;
  name: string;
  price: string | number;
  category: string;
  stock_quantity: number;
}

async function parseError(res: Response, fallback: string): Promise<string> {
  const data = await res.json().catch(() => null);
  return data?.error || `${fallback} (${res.status})`;
}

function money(value: string | number): string {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isNaN(num) ? '0' : String(num);
}

export default function AdminCatalogScreen() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('beer');
  const [stock, setStock] = useState('0');
  const [editingId, setEditingId] = useState<string | null>(null);

  const headers = useCallback(
    () => ({
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    }),
    [accessToken]
  );

  const load = useCallback(async () => {
    if (!accessToken) {
      setError('You are not signed in.');
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const res = await fetch(`${getApiBaseUrl()}/api/admin/products`, { headers: headers() });
      if (!res.ok) throw new Error(await parseError(res, 'Failed to load catalog'));
      setProducts(await res.json());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load catalog');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [accessToken, headers]);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setPrice('');
    setCategory('beer');
    setStock('0');
  };

  const saveProduct = async () => {
    if (!accessToken) return;
    setBusy(true);
    setError(null);
    const payload = {
      name,
      price,
      category,
      stock_quantity: Number(stock),
    };
    try {
      const res = await fetch(
        editingId
          ? `${getApiBaseUrl()}/api/admin/products/${editingId}`
          : `${getApiBaseUrl()}/api/admin/products`,
        {
          method: editingId ? 'PUT' : 'POST',
          headers: headers(),
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) throw new Error(await parseError(res, 'Failed to save product'));
      resetForm();
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save product');
    } finally {
      setBusy(false);
    }
  };

  const editProduct = (product: AdminProduct) => {
    setEditingId(product.id);
    setName(product.name);
    setPrice(money(product.price));
    setCategory(product.category);
    setStock(String(product.stock_quantity));
  };

  const deleteProduct = async (id: string) => {
    if (!accessToken) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/admin/products/${id}`, {
        method: 'DELETE',
        headers: headers(),
      });
      if (!res.ok) throw new Error(await parseError(res, 'Failed to delete product'));
      if (editingId === id) resetForm();
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete product');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
          />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.kicker}>Back Office</Text>
            <Text style={styles.title}>Catalog</Text>
          </View>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/(admin)');
              }
            }}
            accessibilityRole="button"
            accessibilityLabel="Back to Admin Dashboard"
          >
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator testID="catalog-loading" size="large" color="#000000" />
        ) : (
          <>
            {error ? (
              <View style={styles.errorBox} testID="catalog-error">
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>
                {editingId ? 'Edit Product' : 'New Product'}
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Guinness Stout"
                placeholderTextColor="#8E8E93"
                value={name}
                onChangeText={setName}
                testID="product-name"
              />
              <TextInput
                style={styles.input}
                placeholder="Price"
                placeholderTextColor="#8E8E93"
                keyboardType="decimal-pad"
                value={price}
                onChangeText={setPrice}
                testID="product-price"
              />
              <TextInput
                style={styles.input}
                placeholder="Category"
                placeholderTextColor="#8E8E93"
                value={category}
                onChangeText={setCategory}
                testID="product-category"
              />
              <TextInput
                style={styles.input}
                placeholder="Stock quantity"
                placeholderTextColor="#8E8E93"
                keyboardType="number-pad"
                value={stock}
                onChangeText={setStock}
                testID="product-stock"
              />
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={saveProduct}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={editingId ? 'Save Product' : 'Add Product'}
                testID="save-product-btn"
              >
                <Text style={styles.primaryButtonText}>
                  {editingId ? 'Save Product' : 'Add Product'}
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionTitle}>Products</Text>
            {products.map((product) => (
              <View key={product.id} style={styles.itemCard} testID={`product-card-${product.name}`}>
                <View style={styles.itemCopy}>
                  <Text style={styles.itemTitle}>{product.name}</Text>
                  <Text style={styles.itemMeta}>
                    {product.category} · {product.stock_quantity} in stock
                  </Text>
                  <Text style={styles.itemPrice}>{money(product.price)} FCFA</Text>
                </View>
                <View style={styles.itemActions}>
                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={() => editProduct(product)}
                    accessibilityRole="button"
                    accessibilityLabel={`Edit ${product.name}`}
                  >
                    <Text style={styles.secondaryButtonText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.dangerButton}
                    onPress={() => deleteProduct(product.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete ${product.name}`}
                  >
                    <Text style={styles.dangerButtonText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  kicker: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111111',
    marginTop: 4,
  },
  backButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 9999,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backButtonText: {
    color: '#111111',
    fontSize: 13,
    fontWeight: '700',
  },
  errorBox: {
    backgroundColor: '#FDE8E8',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F8B4B4',
    padding: 16,
    marginBottom: 16,
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    padding: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111111',
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#F2F2F7',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#111111',
    marginBottom: 10,
  },
  primaryButton: {
    backgroundColor: '#000000',
    borderRadius: 9999,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  itemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    padding: 18,
    marginBottom: 10,
  },
  itemCopy: {
    marginBottom: 12,
  },
  itemTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111111',
  },
  itemMeta: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 4,
    textTransform: 'capitalize',
  },
  itemPrice: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111111',
    marginTop: 8,
  },
  itemActions: {
    flexDirection: 'row',
    gap: 8,
  },
  secondaryButton: {
    flex: 1,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  secondaryButtonText: {
    color: '#111111',
    fontWeight: '700',
  },
  dangerButton: {
    flex: 1,
    borderRadius: 9999,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#FF3B30',
  },
  dangerButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
