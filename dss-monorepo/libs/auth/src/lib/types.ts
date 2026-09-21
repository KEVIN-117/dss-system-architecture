export type DSSRole = 'SUPERADMIN' | 'RECTOR' | 'DECANO' | 'DIRECTOR';

/** Contexto académico devuelto por auth-service. */
export interface AcademicContext {
  id: string;
  userId: string;
  facultyId: number | null;
  careerId: number | null;
}

/**
 * Perfil local validado por auth-service. Los roles provienen del access token
 * firmado y sólo sirven para adaptar la interfaz; el backend aplica la
 * autorización real.
 */
export interface AuthUser {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  academicContexts: AcademicContext[];
  roles: DSSRole[];
}
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

export interface AuthActions {
    /** Inicia el flujo de login con Keycloak */
    login: () => void;
    /** Cierra la sesión del usuario */
    logout: () => void;
    /** Registra un nuevo usuario */
    register: () => void;
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
