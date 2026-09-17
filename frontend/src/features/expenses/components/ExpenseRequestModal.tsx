import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { getApiBaseUrl } from '../../../core/context/AuthContext';
import { useAuth } from '../../../core/hooks/useAuth';
import { EXPENSE_CATEGORIES, ExpenseCategory } from '../types';

export interface ExpenseRequestModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  apiBaseUrl?: string;
}

export function ExpenseRequestModal({
  visible,
  onClose,
  onSuccess,
  apiBaseUrl,
}: ExpenseRequestModalProps) {
  const { user } = useAuth();
  const baseUrl = apiBaseUrl ?? getApiBaseUrl();

  const [category, setCategory] = useState<ExpenseCategory>('Cigarettes');
  const [amount, setAmount] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const resetForm = () => {
    setCategory('Cigarettes');
    setAmount('');
    setNotes('');
    setErrorMessage(null);
    setSubmitting(false);
  };

  const handleClose = () => {
    if (submitting) return;
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    setErrorMessage(null);

    const numericAmount = parseFloat(amount.replace(/[^0-9.]/g, ''));
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setErrorMessage('Please enter a valid amount greater than 0');
      return;
    }

    if (!category) {
      setErrorMessage('Please select a category');
      return;
    }

    setSubmitting(true);
    try {
      const payload: {
        category: string;
        amount: number;
        notes?: string;
        requested_by?: string;
      } = {
        category,
        amount: numericAmount,
      };

      if (notes.trim()) {
        payload.notes = notes.trim();
      }

      if (user?.id) {
        payload.requested_by = user.id;
      }

      const res = await fetch(`${baseUrl}/api/expenses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Failed to submit expense request (${res.status})`);
      }

      resetForm();
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Network error while submitting request');
    } finally {
      setSubmitting(false);
    }
  };

  const formattedPreview = () => {
    const num = parseFloat(amount.replace(/[^0-9.]/g, ''));
    if (isNaN(num) || num <= 0) return '0 FCFA';
    return `${num.toLocaleString()} FCFA`;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
      testID="expense-request-modal"
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.modalTitle}>New Cash Request</Text>
            <Text style={styles.modalSubtitle}>
              Request direct cash disbursements for store or bar expenses.
            </Text>

            {errorMessage && (
              <View style={styles.errorBanner} testID="expense-request-error">
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}

            {/* Category selection */}
            <Text style={styles.fieldLabel}>Category</Text>
            <View style={styles.categoryWrap}>
              {EXPENSE_CATEGORIES.map((cat) => {
                const isSelected = category === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.categoryChip, isSelected && styles.categoryChipSelected]}
                    onPress={() => setCategory(cat)}
                    accessibilityRole="button"
                    accessibilityLabel={cat}
                    accessibilityState={{ selected: isSelected }}
                    testID={`category-chip-${cat.toLowerCase()}`}
                  >
                    <Text
                      style={[
                        styles.categoryChipText,
                        isSelected && styles.categoryChipTextSelected,
                      ]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Amount input */}
            <Text style={styles.fieldLabel}>Amount (FCFA)</Text>
            <View style={styles.amountInputContainer}>
              <TextInput
                style={styles.amountInput}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor="#8E8E93"
                value={amount}
                onChangeText={setAmount}
                accessibilityLabel="Expense Amount"
                testID="expense-amount-input"
              />
              <Text style={styles.amountPreview} testID="expense-amount-preview">
                {formattedPreview()}
              </Text>
            </View>

            {/* Notes input */}
            <Text style={styles.fieldLabel}>Notes / Purpose (Optional)</Text>
            <TextInput
              style={styles.notesInput}
              placeholder="e.g. 2 packs of Dunhill for bar shelf"
              placeholderTextColor="#8E8E93"
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
              accessibilityLabel="Expense Notes"
              testID="expense-notes-input"
            />

            {/* Action buttons */}
            <View style={styles.buttonsRow}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleClose}
                disabled={submitting}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
                testID="close-expense-modal-btn"
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.submitButton, submitting && styles.disabledButton]}
                onPress={handleSubmit}
                disabled={submitting}
                accessibilityRole="button"
                accessibilityLabel="Submit Request"
                testID="submit-expense-request-btn"
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitButtonText}>Submit Request</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
    maxWidth: 480,
    maxHeight: '90%',
  },
  scrollContent: {
    paddingBottom: 4,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111111',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 20,
    marginBottom: 20,
  },
  errorBanner: {
    backgroundColor: '#FF3B30',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  categoryWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  categoryChip: {
    backgroundColor: '#F2F2F7',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 9999,
    paddingVertical: 10,
    paddingHorizontal: 16,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryChipSelected: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  categoryChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111111',
  },
  categoryChipTextSelected: {
    color: '#FFFFFF',
  },
  amountInputContainer: {
    marginBottom: 20,
  },
  amountInput: {
    backgroundColor: '#F2F2F7',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 28,
    fontWeight: '800',
    color: '#000000',
    minHeight: 60,
    letterSpacing: -0.5,
  },
  amountPreview: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
    marginTop: 6,
    marginLeft: 4,
  },
  notesInput: {
    backgroundColor: '#F2F2F7',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111111',
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 24,
  },
  buttonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  cancelButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 9999,
    paddingVertical: 14,
    paddingHorizontal: 22,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#111111',
    fontSize: 15,
    fontWeight: '700',
  },
  submitButton: {
    backgroundColor: '#000000',
    borderRadius: 9999,
    paddingVertical: 14,
    paddingHorizontal: 26,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  disabledButton: {
    backgroundColor: '#E5E5EA',
  },
});
