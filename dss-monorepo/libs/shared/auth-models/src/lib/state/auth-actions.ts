import type { DSSRole } from '../roles/dss-role.js';
import type { AuthUser } from '../users/auth-user.js';

export interface AuthActions {
    /** Inicia el flujo de login con Keycloak */
    login: (returnTo?: string) => void;
    /** Cierra la sesión del usuario */
    logout: () => void;
    /** Registra un nuevo usuario */
    register: (returnTo?: string) => void;
    /**
    * Obtiene un access_token válido (renovado si es necesario).
    * Úsalo para headers Authorization: Bearer <token>.
     * El refresh token permanece dentro de Keycloak y no se expone por el
     * contexto React.
     */
    getToken: () => Promise<string | undefined>;
    /**
     * Obtiene el usuario autenticado.
     */
    getUser: () => AuthUser | null;
    /**
     * Verifica si el usuario tiene un rol específico.
     */
    hasRole: (role: DSSRole) => boolean;
    /**
     * Verifica si el usuario tiene un permiso específico.
     */
    hasPermission: (permission: string) => boolean;
}
