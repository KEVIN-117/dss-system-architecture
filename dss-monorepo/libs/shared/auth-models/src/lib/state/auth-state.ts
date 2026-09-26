import type { AuthUser } from '../users/auth-user.js';

/**
 * Interface para describir el estado de la autenticación
 */
export interface AuthState {
    /** Indica si el usuario está autenticado */
    isAuthenticated: boolean;
    /** Indica si la aplicación está cargando */
    isLoading: boolean;
    /** Error en caso de que exista */
    error: string | null;
    /** Usuario autenticado */
    user: AuthUser | null;
    /** Access token */
    token: string | null;
    /** Último login */
    lastLogin: Date | null;
    /** Indica si la aplicación está inicializada */
    isInitialized: boolean;
    /** Permisos del usuario */
    permissions: string[];
}
