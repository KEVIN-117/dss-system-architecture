# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- Desarrolladores que necesitan comprender, desplegar e integrar los servicios del DSS.
- Directivos de la UATF que necesitan entender el propósito, las capacidades, los límites y el estado del DSS.
- Administradores y operadores que necesitan consultar tareas, permisos y procedimientos autorizados.

## Product Purpose

El portal reúne documentación confiable del Sistema de Soporte a Decisiones de la UATF para que cada audiencia encuentre guías comprensibles y referencias técnicas mantenidas junto al código.

## Positioning

Una fuente versionada en el repositorio que conecta guías para distintos perfiles con contratos OpenAPI y documentación de los servicios del DSS.

## Operating Context

- El contenido inicial se escribe en español y debe poder ampliarse a otros idiomas en el futuro.
- La documentación general y las integraciones aprobadas pueden ser públicas; el material administrativo, operativo y de seguridad requiere acceso restringido.
- El portal se implementa como una aplicación Next.js dentro del monorepo DSS.

## Capabilities and Constraints

- Las guías se autoran en Markdown/MDX y se renderizan en el portal.
- Las referencias REST reutilizan contratos OpenAPI existentes cuando estén disponibles.
- Las páginas restringidas deben respetar su clasificación también en enlaces y artefactos asociados.
- El portal está en estado inicial; el contenido, las rutas y las integraciones se incorporarán de forma incremental.

## Brand Commitments

- Conservar la paleta institucional DSS definida por el design system compartido.
- Usar Apidog como referencia de navegación y lectura de documentación API, sin reproducir su marca o interfaz literalmente.
- Escribir la experiencia y el contenido inicial en español.

## Evidence on Hand

- Aplicación: `apps/docs-portal`.
- Diseño compartido: `libs/ui/design-system/src/styles/globals.css`.
- Referencias visuales indicadas: https://apidog.com/es/ y https://app.eu.apidog.com/project/369754.

## Product Principles

- Mantener una fuente de verdad enlazada al código y a los contratos API.
- Organizar el contenido por las necesidades de cada audiencia y también por servicio.
- Hacer que la información sea legible, accesible y navegable en móvil.
- No publicar material sensible en áreas públicas.

## Accessibility & Inclusion

La navegación y los controles deben ser operables con teclado, usar estructura semántica, mostrar foco visible y mantener contraste legible. La experiencia debe adaptarse a móvil.
