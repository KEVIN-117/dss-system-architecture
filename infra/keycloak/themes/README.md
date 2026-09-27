# Tema de login DSS para Keycloak

El tema `dss` extiende el tema de login incorporado por Keycloak y conserva sus
plantillas Freemarker. Solo reemplaza la capa visual con la identidad de la
landing: navy institucional, azul eléctrico, cyan de foco y rojo para errores.
El logotipo de DSA se sirve desde `login/resources/img/dsa.png`.

## Integración

El `Dockerfile` copia `themes/` al directorio de Keycloak durante la imagen de
build. Después de cambiar el tema hay que reconstruir y recrear el contenedor:

```bash
docker compose build keycloak
docker compose up -d keycloak
```

El realm exportado ya declara `loginTheme: dss`, `es` como idioma predeterminado
y `en` como alternativa. En un realm que ya existe, la importación de desarrollo
no sobrescribe sus ajustes: selecciona `dss` en **Realm settings → Themes →
Login theme** y guarda. Activa también la internacionalización si se necesitan
los selectores de idioma.

Para iterar estilos localmente se puede iniciar Keycloak con la caché de temas
desactivada. En producción debe volver a habilitarse la caché.

## Compatibilidad

La hoja propia se carga después de `css/login.css`, como recomienda la
documentación oficial de Keycloak. No se copian ni modifican las plantillas del
tema padre; de esa forma los flujos de contraseña, MFA, recuperación y errores
siguen recibiendo las actualizaciones de seguridad de Keycloak.
