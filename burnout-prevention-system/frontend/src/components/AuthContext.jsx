import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const BACKEND_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const TOKEN_KEY = 'guardian_jwt';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

/**
 * AuthProvider — manages JWT-based auth state with localStorage persistence.
 * Provides: currentUser, token, login(), register(), logout(), isLoading.
 */
export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(null);
    const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
    const [isLoading, setIsLoading] = useState(true);

    // ── Axios interceptor: attach Bearer token to every request ──
    useEffect(() => {
        const interceptor = axios.interceptors.request.use((config) => {
            const storedToken = localStorage.getItem(TOKEN_KEY);
            if (storedToken) {
                config.headers.Authorization = `Bearer ${storedToken}`;
            }
            return config;
        });
        return () => axios.interceptors.request.eject(interceptor);
    }, []);

    // ── On mount / token change: validate with /api/me ──
    useEffect(() => {
        if (!token) {
            setCurrentUser(null);
            setIsLoading(false);
            return;
        }

        axios.get(`${BACKEND_URL}/api/me`, {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then(res => setCurrentUser(res.data))
            .catch(() => {
                // Token invalid or expired — clear it
                localStorage.removeItem(TOKEN_KEY);
                setToken(null);
                setCurrentUser(null);
            })
            .finally(() => setIsLoading(false));
    }, [token]);

    // ── Login ──
    const login = useCallback(async (identifier, password) => {
        const payload = { username: identifier, password };
        if (identifier.includes('@')) payload.email = identifier;

        const res = await axios.post(`${BACKEND_URL}/api/login`, payload);
        const { token: newToken, user } = res.data;

        localStorage.setItem(TOKEN_KEY, newToken);
        setToken(newToken);
        setCurrentUser(user);

        return user;
    }, []);

    // ── Register ──
    const register = useCallback(async (formData) => {
        const res = await axios.post(`${BACKEND_URL}/api/register`, formData);
        const { token: newToken, user } = res.data;

        localStorage.setItem(TOKEN_KEY, newToken);
        setToken(newToken);
        setCurrentUser(user);

        return user;
    }, []);

    // ── Logout ──
    const logout = useCallback(async () => {
        try {
            await axios.post(`${BACKEND_URL}/api/logout`);
        } catch (_) { /* ignore */ }
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setCurrentUser(null);
    }, []);

    const value = {
        currentUser,
        token,
        isLoading,
        login,
        register,
        logout,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export default AuthContext;
