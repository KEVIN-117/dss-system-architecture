# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Analistas y responsables académicos que necesitan explorar cubos OLAP con más detalle que las estadísticas resumidas de los portales por rol.

## Product Purpose

OLAP Workspace reúne la exploración de cubos y el acceso a dashboards y apps analíticas guardadas para que el usuario pueda profundizar en los datos institucionales.

## Positioning

Es el espacio de análisis detallado del DSS; los portales de decano, director y rector presentan vistas resumidas y predicciones para sus funciones.

## Operating Context

- Aplicación web Next.js con App Router.
- La interfaz usa español.
- Las solicitudes OLAP pasan por el BFF y su sesión segura.
- Dashboards y apps se cargan desde el repositorio de Saiku.

## Capabilities and Constraints

- Reutiliza componentes del paquete `@dss-monorepo/design-system`.
- El layout de dashboards se basa en `DashboardGrid` y en los contratos del `dashboard-engine`.
- Las consultas y el acceso a archivos se canalizan mediante `olap-connector` a través de la capa `olap-data-access`.
- Los tokens de sesión permanecen bajo control del BFF.
- El puerto local reservado para esta aplicación es 3007.

## Brand Commitments

- Producto: UATF DSS.
- La interfaz conserva los tokens y componentes del design system del monorepo.

## Evidence on Hand

- `libs/ui/design-system/src/organisms/olap/` contiene los componentes OLAP.
- `libs/ui/design-system/src/organisms/dashboard/` contiene la cuadrícula y los bloques de dashboard.
- `libs/ui/design-system/src/organisms/app-builder/` contiene el shell de apps.
- `libs/connectors/olap-connector/` contiene los clientes Saiku para dashboards y apps.

## Product Principles

- Permitir análisis detallado en un espacio dedicado.
- Reutilizar los componentes y tokens compartidos.
- Usar el BFF como frontera de sesión y acceso OLAP.
- Mostrar estados de carga, error y vacío con acciones claras.
