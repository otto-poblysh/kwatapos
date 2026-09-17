import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

export interface Requisition {
  id: string;
  token: string;
  status: string;
  total_amount?: number;
  created_at?: string;
}

export default function RequisitionsScreen() {
  const router = useRouter();
  const [requisitions] = useState<Requisition[]>([]);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.push('/(manager)');
    }
  };

  const handleDraftFirstRequisition = () => {
    router.push('/(manager)/requisitions/new' as any);
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
        <View style={styles.headerPlaceholder} />
      </View>

      {requisitions.length === 0 ? (
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
              onPress={handleDraftFirstRequisition}
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
          {/* Populated requisitions list */}
        </ScrollView>
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
  headerPlaceholder: {
    width: 44,
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
  },
});
