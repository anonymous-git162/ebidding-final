import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import api from '../services/api';

interface User {
  id: string;
  email: string;
  fullName: string;
  role: string;
  isActive?: boolean;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

function clearAuthStorage() {
  sessionStorage.removeItem('accessToken');
  sessionStorage.removeItem('refreshToken');
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = sessionStorage.getItem('accessToken');
    if (token) {
      api.get('/auth/me')
        .then((res) => setUser(res.data))
        .catch(() => { clearAuthStorage(); })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post('/auth/login', { email, password });
    sessionStorage.setItem('accessToken', res.data.accessToken);
    sessionStorage.setItem('refreshToken', res.data.refreshToken);
    setUser(res.data.user);
  }, []);

  const logout = useCallback(() => {
    api.post('/auth/logout').catch(() => {});
    clearAuthStorage();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
