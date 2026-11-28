# Changelog

## [1.13.0](https://github.com/KEVIN-117/dss-system-architecture/compare/admin-portal-v1.12.0...admin-portal-v1.13.0) (2026-11-28)


### Features

* **admin-portal:** elegir la aplicación del rol (IAM-022) ([#429](https://github.com/KEVIN-117/dss-system-architecture/issues/429)) ([4739a42](https://github.com/KEVIN-117/dss-system-architecture/commit/4739a4275d24a04b60e01511f32370402b077a6a))
* Permisos de acceso a aplicaciones (portal:*) en Keycloak ([#423](https://github.com/KEVIN-117/dss-system-architecture/issues/423)) ([ea109bc](https://github.com/KEVIN-117/dss-system-architecture/commit/ea109bc373ddac78f59765216a497805e3339959))

## [1.12.0](https://github.com/KEVIN-117/dss-system-architecture/compare/admin-portal-v1.11.0...admin-portal-v1.12.0) (2026-11-26)


### Features

* **admin-portal:** asistente ML Studio, jobs y pronósticos; prediction-service en 18007 ([#403](https://github.com/KEVIN-117/dss-system-architecture/issues/403)) ([1dfff7e](https://github.com/KEVIN-117/dss-system-architecture/commit/1dfff7e5fe010735b11395a421dba42b843d86d3))

## [1.11.0](https://github.com/KEVIN-117/dss-system-architecture/compare/admin-portal-v1.10.0...admin-portal-v1.11.0) (2026-11-24)


### Features

* **prediction-service:** catálogo de tareas ML y eliminación del requisito DSA ([#389](https://github.com/KEVIN-117/dss-system-architecture/issues/389)) ([cb7f6e0](https://github.com/KEVIN-117/dss-system-architecture/commit/cb7f6e016877a58df1c3ca229db8fcaff1376460))

## [1.10.0](https://github.com/KEVIN-117/dss-system-architecture/compare/admin-portal-v1.9.0...admin-portal-v1.10.0) (2026-11-24)


### Features

* **admin-portal:** sección Load Manager e indicador de ETL en el header (LM-007) ([#379](https://github.com/KEVIN-117/dss-system-architecture/issues/379)) ([58e9dd3](https://github.com/KEVIN-117/dss-system-architecture/commit/58e9dd3429ee27d8cb0294f7f765220cb3a8355f))

## [1.9.0](https://github.com/KEVIN-117/dss-system-architecture/compare/admin-portal-v1.8.0...admin-portal-v1.9.0) (2026-11-22)


### Features

* **load-manager:** Implementado Hop Server como motor de ejecución del proyecto ETL ([#357](https://github.com/KEVIN-117/dss-system-architecture/issues/357)) ([285b9e4](https://github.com/KEVIN-117/dss-system-architecture/commit/285b9e408de4d764ae0763152bac0bfdd2693410))
* **ui-ux:** ui mejorado ([c056617](https://github.com/KEVIN-117/dss-system-architecture/commit/c0566170e0ff228d12531b1ee987482a239b6c78))

## [1.8.0](https://github.com/KEVIN-117/dss-system-architecture/compare/admin-portal-v1.7.0...admin-portal-v1.8.0) (2026-11-22)


### Features

* **iam:** Documentación y limpieza del modelo IAM ([#335](https://github.com/KEVIN-117/dss-system-architecture/issues/335)) ([3b559ef](https://github.com/KEVIN-117/dss-system-architecture/commit/3b559ef12c283d7d67c88de4b845817278f0528e))

## [1.7.0](https://github.com/KEVIN-117/dss-system-architecture/compare/admin-portal-v1.6.0...admin-portal-v1.7.0) (2026-11-21)


### Features

* **Admin-portal:** gestión de clientes y vista de auditoría ([#332](https://github.com/KEVIN-117/dss-system-architecture/issues/332)) ([e7a9f55](https://github.com/KEVIN-117/dss-system-architecture/commit/e7a9f553650e45d816b500bb6f5412802fd7747b))

## [1.6.0](https://github.com/KEVIN-117/dss-system-architecture/compare/admin-portal-v1.5.0...admin-portal-v1.6.0) (2026-11-20)


### Features

* **Admin-portal:** gestión de roles y permisos ([#330](https://github.com/KEVIN-117/dss-system-architecture/issues/330)) ([7a74b91](https://github.com/KEVIN-117/dss-system-architecture/commit/7a74b9192561bafdf2b35696e84e3444d71bfe39))
* **Admin-portal:** users management ([#327](https://github.com/KEVIN-117/dss-system-architecture/issues/327)) ([638d675](https://github.com/KEVIN-117/dss-system-architecture/commit/638d675395f2156bf4766543c5ee187cd9d7e30c))

## [1.5.0](https://github.com/KEVIN-117/dss-system-architecture/compare/admin-portal-v1.4.1...admin-portal-v1.5.0) (2026-11-20)


### Features

* **bff:** resolver permisos desde el token y eliminar el modelo fijo ([#316](https://github.com/KEVIN-117/dss-system-architecture/issues/316)) ([5a054b2](https://github.com/KEVIN-117/dss-system-architecture/commit/5a054b26b22a2333757f1ad641043b18b0724a4e))

## [1.4.1](https://github.com/KEVIN-117/dss-system-architecture/compare/admin-portal-v1.4.0...admin-portal-v1.4.1) (2026-11-18)


### Bug Fixes

* fixed test and lint on apps ([ab889b1](https://github.com/KEVIN-117/dss-system-architecture/commit/ab889b1f8dece67a7599893037d9823be830c534))
* fixed test and lint on apps ([855e064](https://github.com/KEVIN-117/dss-system-architecture/commit/855e0646d3e541869c0607a1903dbdae7cad82b3))
* **prediction:** auditoría PRED-011 — seguridad, robustez de jobs y contrato de features ([#257](https://github.com/KEVIN-117/dss-system-architecture/issues/257)) ([44eea0e](https://github.com/KEVIN-117/dss-system-architecture/commit/44eea0e7d2af3207d186f30d0f422d3c15c19617))

## [1.4.0](https://github.com/KEVIN-117/dss-system-architecture/compare/admin-portal-v1.3.0...admin-portal-v1.4.0) (2026-11-10)


### Features

* **prediction:** permitir carga de datasets preparados para entrenamiento ML ([#251](https://github.com/KEVIN-117/dss-system-architecture/issues/251)) ([0812d21](https://github.com/KEVIN-117/dss-system-architecture/commit/0812d210dad92261fcb087686d250d63525a8d1a))

## [1.3.0](https://github.com/KEVIN-117/dss-system-architecture/compare/admin-portal-v1.2.0...admin-portal-v1.3.0) (2026-11-10)


### Features

* **frontend:** conectar analítica académica del Director ([#159](https://github.com/KEVIN-117/dss-system-architecture/issues/159)) ([#242](https://github.com/KEVIN-117/dss-system-architecture/issues/242)) ([ea33bdf](https://github.com/KEVIN-117/dss-system-architecture/commit/ea33bdf357b69daa5c4d2378a1d7d7377514691c))

## [1.2.0](https://github.com/KEVIN-117/dss-system-architecture/compare/admin-portal-v1.1.0...admin-portal-v1.2.0) (2026-11-08)


### Features

* **frontend:** conectar Rector Dashboard con analítica institucional ([#238](https://github.com/KEVIN-117/dss-system-architecture/issues/238)) ([cdc8e08](https://github.com/KEVIN-117/dss-system-architecture/commit/cdc8e08c675ea40583e3284be0f4d171e5269aad))

## [1.1.0](https://github.com/KEVIN-117/dss-system-architecture/compare/admin-portal-v1.0.0...admin-portal-v1.1.0) (2026-11-06)


### Features

* **prediction:** add ML operations and load characterization ([#234](https://github.com/KEVIN-117/dss-system-architecture/issues/234)) ([3abe620](https://github.com/KEVIN-117/dss-system-architecture/commit/3abe620e77ae3eccfadd264d40e52a5488be483a))

## 1.0.0 (2026-10-28)


### Features

* **admin:** manage academic closures ([#199](https://github.com/KEVIN-117/dss-system-architecture/issues/199)) ([061b925](https://github.com/KEVIN-117/dss-system-architecture/commit/061b92592bcb54967631ffc32c9c2ccd4a41100d))
* **dw-control:** monitor ETL executions and publish image ([#200](https://github.com/KEVIN-117/dss-system-architecture/issues/200)) ([c1515fb](https://github.com/KEVIN-117/dss-system-architecture/commit/c1515fb32ad4aed8f73d6967a187aedb65e72730))
* integrar Admin Portal y actualizar servicios de datos ([3b0334a](https://github.com/KEVIN-117/dss-system-architecture/commit/3b0334aeb6e14e981264c3c0cd89dd4bcd5f60c4))
