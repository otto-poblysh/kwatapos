import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Slot, useRouter, useSegments } from 'expo-router';
import { AuthProvider, useAuth } from '../core/hooks/useAuth';

function NavigationGuard() {
  const { user, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!user) {
      if (!inAuthGroup) {
        router.replace('/(auth)/login');
      }
    } else {
      if (inAuthGroup) {
        if (user.role === 'admin') {
          router.replace('/(admin)');
        } else if (user.role === 'manager') {
          router.replace('/(manager)');
        } else {
          router.replace('/(sales)');
        }
      } else if (segments[0] === '(admin)' && user.role !== 'admin') {
        if (user.role === 'manager') {
          router.replace('/(manager)');
        } else {
          router.replace('/(sales)');
        }
      } else if (segments[0] === '(manager)' && user.role === 'sales') {
        router.replace('/(sales)');
      }
    }
  }, [user, isLoading, segments, router]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#000000" testID="root-loading" />
      </View>
    );
  }

  return <Slot />;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <NavigationGuard />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
