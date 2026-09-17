import React from 'react';
import LoginScreen from '../../features/auth/components/LoginScreen';
import { useAuth } from '../../core/hooks/useAuth';

export default function LoginRoute() {
  const { login } = useAuth();

  const handleLogin = async (credentials: { email: string; password: string }) => {
    await login(credentials.email, credentials.password);
  };

  return <LoginScreen onLogin={handleLogin} />;
}
