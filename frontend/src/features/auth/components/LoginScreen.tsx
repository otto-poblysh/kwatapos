import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';

export interface LoginScreenProps {
  onLogin: (credentials: { email: string; password: string }) => Promise<void> | void;
  isLoading?: boolean;
  error?: string | null;
}

export default function LoginScreen({ onLogin, isLoading = false, error = null }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const displayError = error || localError;
  const loading = isLoading || isSubmitting;

  const handleSubmit = async () => {
    setLocalError(null);
    if (!email.trim() || !password.trim()) {
      setLocalError('Please enter both email and password.');
      return;
    }

    try {
      setIsSubmitting(true);
      await onLogin({ email: email.trim(), password });
    } catch (err: unknown) {
      if (err instanceof Error) {
        setLocalError(err.message);
      } else {
        setLocalError('An unexpected error occurred during login.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Text style={styles.brandTitle}>Kwata POS</Text>
          <Text style={styles.subtitle}>Sign in to your account</Text>

          {displayError ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{displayError}</Text>
            </View>
          ) : null}

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Email Address</Text>
            <TextInput
              testID="email-input"
              style={styles.input}
              placeholder="Enter your email"
              placeholderTextColor="#8E8E93"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (localError) setLocalError(null);
              }}
              editable={!loading}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Password</Text>
            <TextInput
              testID="password-input"
              style={styles.input}
              placeholder="Enter your password"
              placeholderTextColor="#8E8E93"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (localError) setLocalError(null);
              }}
              editable={!loading}
            />
          </View>

          <TouchableOpacity
            testID="login-button"
            style={[styles.primaryButton, loading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Login"
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator
                testID="login-loading-indicator"
                color="#FFFFFF"
                size="small"
              />
            ) : (
              <Text style={styles.buttonText}>Login</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            testID="quick-sales-button"
            onPress={() => {
              setEmail('sales@kwatapos.com');
              setPassword('sales123');
            }}
            accessibilityRole="button"
            accessibilityLabel="Quick Fill Sales"
            style={styles.quickFillButton}
          >
            <Text style={styles.quickFillText}>Quick Fill: Sales Staff</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    padding: 24,
    width: '100%',
    maxWidth: 420,
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111111',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 20,
  },
  errorContainer: {
    backgroundColor: '#FDE8E8',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F8B4B4',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  fieldGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111111',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#111111',
  },
  primaryButton: {
    backgroundColor: '#000000',
    borderRadius: 9999,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    minHeight: 52,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  quickFillButton: {
    marginTop: 14,
    paddingVertical: 10,
    alignItems: 'center',
  },
  quickFillText: {
    color: '#8E8E93',
    fontSize: 13,
    fontWeight: '600',
  },
});
