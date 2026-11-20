package uatf.dss.authservice.adapter.out.keycloak;

import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpMethod;
import uatf.dss.authservice.application.port.out.IdentityUserAdminPort;
import uatf.dss.authservice.domain.exception.notfound.IdentityResourceNotFoundException;
import uatf.dss.authservice.domain.model.identity.IdentityRequiredAction;
import uatf.dss.authservice.domain.model.identity.IdentityUser;
import uatf.dss.authservice.domain.model.identity.IdentityUserChanges;
import uatf.dss.authservice.domain.model.identity.NewIdentityUser;

import java.time.Duration;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static uatf.dss.authservice.adapter.out.keycloak.KeycloakAdminHttpClient.Call;

/** {@link IdentityUserAdminPort} on {@code /admin/realms/{realm}/users}. */
class KeycloakUserAdminAdapter implements IdentityUserAdminPort {

    private static final ParameterizedTypeReference<List<KeycloakRepresentations.UserRepresentation>> USERS =
            new ParameterizedTypeReference<>() {
            };

    private final KeycloakAdminHttpClient http;

    KeycloakUserAdminAdapter(KeycloakAdminHttpClient http) {
        this.http = http;
    }

    @Override
    public List<IdentityUser> searchUsers(String search, int first, int max) {
        return KeycloakMappers.toDomainUsers(http.fetch(Call.of(HttpMethod.GET, "buscar usuarios", "/users")
                .query("search", blankToNull(search))
                .query("first", first)
                .query("max", max)
                .query("briefRepresentation", false), USERS));
    }

    @Override
    public long countUsers(String search) {
        Long count = http.fetch(Call.of(HttpMethod.GET, "contar usuarios", "/users/count")
                .query("search", blankToNull(search)), Long.class);
        return count == null ? 0 : count;
    }

    @Override
    public Optional<IdentityUser> findUserById(String userId) {
        try {
            return Optional.of(KeycloakMappers.toDomain(http.fetch(
                    Call.of(HttpMethod.GET, "obtener usuario " + userId, "/users/{id}", userId),
                    KeycloakRepresentations.UserRepresentation.class)));
        } catch (IdentityResourceNotFoundException notFound) {
            return Optional.empty();
        }
    }

    @Override
    public Optional<IdentityUser> findUserByUsername(String username) {
        return KeycloakMappers.toDomainUsers(http.fetch(Call.of(HttpMethod.GET, "buscar usuario " + username, "/users")
                        .query("username", username)
                        .query("exact", true), USERS))
                .stream()
                .filter(user -> username.equalsIgnoreCase(user.username()))
                .findFirst();
    }

    @Override
    public String createUser(NewIdentityUser user) {
        return http.create(Call.of(HttpMethod.POST, "crear usuario " + user.username(), "/users")
                .body(KeycloakMappers.toRepresentation(user)));
    }

    @Override
    public void updateUser(String userId, IdentityUserChanges changes) {
        http.send(Call.of(HttpMethod.PUT, "actualizar usuario " + userId, "/users/{id}", userId)
                .body(KeycloakMappers.toRepresentation(changes)));
    }

    @Override
    public void deleteUser(String userId) {
        http.send(Call.of(HttpMethod.DELETE, "eliminar usuario " + userId, "/users/{id}", userId));
    }

    @Override
    public void sendRequiredActionsEmail(String userId, Set<IdentityRequiredAction> actions, Duration lifespan) {
        List<String> names = actions.stream().map(Enum::name).sorted().toList();
        http.send(Call.of(HttpMethod.PUT, "enviar acciones requeridas a " + userId,
                        "/users/{id}/execute-actions-email", userId)
                .query("lifespan", lifespan == null ? null : lifespan.toSeconds())
                .body(names));
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
