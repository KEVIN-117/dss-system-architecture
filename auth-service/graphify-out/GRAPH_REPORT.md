# Graph Report - .  (2026-10-06)

## Corpus Check
- Corpus is ~13,880 words - fits in a single context window. You may not need a graph.

## Summary
- 22 nodes · 13 edges · 11 communities (4 shown, 7 thin omitted)
- Extraction: 77% EXTRACTED · 23% INFERRED · 0% AMBIGUOUS · INFERRED: 3 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Component 0
- Component 1
- Component 2
- Component 3
- Component 4
- Component 5
- Component 6
- Component 7
- Component 8
- Component 9

## God Nodes (most connected - your core abstractions)
1. `Ports and Adapters` - 4 edges
2. `Auth Service` - 3 edges
3. `Dependency Inversion` - 2 edges
4. `Domain Layer` - 2 edges
5. `Application Layer` - 2 edges
6. `Keycloak` - 2 edges
7. `users table` - 2 edges
8. `roles table` - 2 edges
9. `user_roles table` - 2 edges
10. `Adapter Layer` - 1 edges

## Surprising Connections (you probably didn't know these)
- `Auth Service` --semantically_similar_to--> `uatf-auth-service client`  [INFERRED] [semantically similar]
  README.md → docs/keycloak/keycloak_specification.md
- `Keycloak` --semantically_similar_to--> `uatf-realm`  [INFERRED] [semantically similar]
  README.md → docs/keycloak/keycloak_specification.md
- `Auth Service` --references--> `Ports and Adapters`  [EXTRACTED]
  README.md → ARCHITECTURE_GUIDE.md
- `SUPERADMIN` --conceptually_related_to--> `roles table`  [INFERRED]
  docs/keycloak/keycloak_specification.md → docs/database/improved_erd.md

## Hyperedges (group relationships)
- **Hexagonal Architecture Layers** — architecture_guide_domain, architecture_guide_application, architecture_guide_adapter [INFERRED 0.95]
- **Keycloak Realm Roles** — docs_keycloak_keycloak_specification_superadmin, docs_keycloak_keycloak_specification_rector, docs_keycloak_keycloak_specification_decano, docs_keycloak_keycloak_specification_director [EXTRACTED 1.00]

## Communities (11 total, 7 thin omitted)

### Community 0 - "Component 0"
Cohesion: 0.50
Nodes (5): Adapter Layer, Application Layer, Dependency Inversion, Domain Layer, Ports and Adapters

### Community 1 - "Component 1"
Cohesion: 0.40
Nodes (5): roles table, user_academic_contexts table, user_roles table, users table, SUPERADMIN

### Community 2 - "Component 2"
Cohesion: 0.50
Nodes (4): uatf-auth-service client, uatf-realm, Auth Service, Keycloak

## Knowledge Gaps
- **12 isolated node(s):** `Adapter Layer`, `MapStruct`, `ArchUnit`, `user_academic_contexts table`, `uatf-realm` (+7 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Ports and Adapters` connect `Component 0` to `Component 2`?**
  _High betweenness centrality (0.093) - this node is a cross-community bridge._
- **Why does `Auth Service` connect `Component 2` to `Component 0`?**
  _High betweenness centrality (0.081) - this node is a cross-community bridge._
- **What connects `Adapter Layer`, `MapStruct`, `ArchUnit` to the rest of the system?**
  _12 weakly-connected nodes found - possible documentation gaps or missing edges._