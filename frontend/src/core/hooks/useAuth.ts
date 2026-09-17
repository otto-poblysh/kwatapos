import { useContext } from 'react';
import { AuthContext, AuthContextType } from '../context/AuthContext';

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export { AuthProvider, getApiBaseUrl, authStorage, ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, USER_KEY } from '../context/AuthContext';
export type { User, AuthContextType } from '../context/AuthContext';
export default useAuth;
