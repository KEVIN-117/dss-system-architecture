# Referencia técnica de Saiku OLAP

Esta carpeta contiene la documentación general consolidada desde `olap-service/docs` del repositorio Saiku. Las páginas de [arquitectura OLAP del monorepo](../README.md) documentan los flujos propios de esta implementación y sus diagramas.

## Índice

- API y consultas: [AI Query](AI-QUERY-API.md), [OSSIE](AI-OSSIE-API.md), [GraphQL](GRAPHQL-API.md), [anotaciones de esquema](schema-annotations.md).
- Seguridad: [Keycloak Resource Server](keycloak-resource-server.md), [política para funciones de IA](security/SECURITY-AI.md).
- MCP: [guía de uso](mcp/README.md), [especificación](MCP-SERVER-SPEC.md), [migración al endpoint nativo](mcp-native-migration.md).
- Operación y calidad: [observabilidad](observability.md), [métricas](metrics.md), [calidad](quality.md), [publicación](releasing.md), [niveles de riesgo](risk-tiers.md).
- Semántica e integración: [Ossie](AI-OSSIE-API.md), [ejemplo dbt](dbt-hookup/README.md), [fork de Mondrian](mondrian-fork.md).
- Diseño e historial: [planes](plans/), [especificaciones](superpowers/specs/), [reflexiones](reflections/), [evaluación](EVAL-SPEC.md).

Los planes y especificaciones conservados son material de referencia; su presencia no implica que una interfaz web forme parte del servicio actual. Para ejecutar Saiku, integrar la autenticación o seguir los diagramas de secuencia, comienza por el [índice OLAP del monorepo](../README.md).
