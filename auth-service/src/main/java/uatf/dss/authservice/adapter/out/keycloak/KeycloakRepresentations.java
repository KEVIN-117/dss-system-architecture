package uatf.dss.authservice.adapter.out.keycloak;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;
import java.util.Map;

/**
 * Subset of the Keycloak Admin REST API representations used by auth-service. Unknown fields are ignored and
 * {@code null} fields are not sent, so partial updates leave the other attributes untouched.
 */
final class KeycloakRepresentations {

    private KeycloakRepresentations() {
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    @JsonIgnoreProperties(ignoreUnknown = true)
    record UserRepresentation(
            String id,
            String username,
            String email,
            String firstName,
            String lastName,
            Boolean enabled,
            Boolean emailVerified,
            Long createdTimestamp) {
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    @JsonIgnoreProperties(ignoreUnknown = true)
    record RoleRepresentation(
            String id,
            String name,
            String description,
            Boolean composite,
            Boolean clientRole,
            String containerId,
            Map<String, List<String>> attributes) {

        /** Minimal form accepted by role-mapping and composite endpoints. */
        static RoleRepresentation reference(RoleRepresentation role) {
            return new RoleRepresentation(role.id(), role.name(), null, null, null, null, null);
        }
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    @JsonIgnoreProperties(ignoreUnknown = true)
    record ClientRepresentation(
            String id,
            String clientId,
            String name,
            String description,
            Boolean enabled,
            Boolean publicClient,
            Boolean bearerOnly,
            Boolean standardFlowEnabled,
            Boolean implicitFlowEnabled,
            Boolean directAccessGrantsEnabled,
            Boolean serviceAccountsEnabled,
            List<String> redirectUris,
            List<String> webOrigins,
            String protocol,
            Map<String, String> attributes) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record CredentialRepresentation(String type, String value) {
        @Override
        public String toString() {
            return "CredentialRepresentation[type=" + type + ", value=****]";
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record TokenResponse(
            @JsonProperty("access_token") String accessToken,
            @JsonProperty("expires_in") Long expiresIn) {
        @Override
        public String toString() {
            return "TokenResponse[accessToken=****, expiresIn=" + expiresIn + "]";
        }
    }
}
