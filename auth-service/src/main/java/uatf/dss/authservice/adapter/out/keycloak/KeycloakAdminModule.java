package uatf.dss.authservice.adapter.out.keycloak;

import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;
import uatf.dss.authservice.application.port.out.IdentityClientAdminPort;
import uatf.dss.authservice.application.port.out.IdentityRoleAdminPort;
import uatf.dss.authservice.application.port.out.IdentityRoleMappingPort;
import uatf.dss.authservice.application.port.out.IdentityUserAdminPort;

import java.net.http.HttpClient;
import java.time.Clock;

/**
 * Builds the Keycloak Admin REST API adapter: one HTTP client, one cached service-account token and one
 * client-id cache shared by the four identity ports.
 */
public final class KeycloakAdminModule {

    private final IdentityUserAdminPort users;
    private final IdentityRoleAdminPort roles;
    private final IdentityRoleMappingPort roleMappings;
    private final IdentityClientAdminPort clients;

    private KeycloakAdminModule(KeycloakAdminHttpClient http) {
        KeycloakClientIdResolver clientIds = new KeycloakClientIdResolver(http);
        KeycloakRoleAdminAdapter roleAdapter = new KeycloakRoleAdminAdapter(http, clientIds);
        this.users = new KeycloakUserAdminAdapter(http);
        this.roles = roleAdapter;
        this.roleMappings = new KeycloakRoleMappingAdapter(http, clientIds, roleAdapter);
        this.clients = new KeycloakClientAdminAdapter(http, clientIds);
    }

    public static KeycloakAdminModule create(KeycloakAdminProperties properties, Clock clock) {
        HttpClient httpClient = HttpClient.newBuilder()
                .connectTimeout(properties.connectTimeout())
                .followRedirects(HttpClient.Redirect.NEVER)
                .build();
        JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(httpClient);
        requestFactory.setReadTimeout(properties.readTimeout());
        RestClient restClient = RestClient.builder()
                .requestFactory(requestFactory)
                .baseUrl(properties.baseUrl())
                .build();
        return create(restClient, properties, clock);
    }

    /** Visible for tests that need to plug a mock server into the {@link RestClient}. */
    static KeycloakAdminModule create(RestClient restClient, KeycloakAdminProperties properties, Clock clock) {
        KeycloakAdminTokenProvider tokens = new KeycloakAdminTokenProvider(restClient, properties, clock);
        return new KeycloakAdminModule(new KeycloakAdminHttpClient(restClient, tokens, properties));
    }

    public IdentityUserAdminPort users() {
        return users;
    }

    public IdentityRoleAdminPort roles() {
        return roles;
    }

    public IdentityRoleMappingPort roleMappings() {
        return roleMappings;
    }

    public IdentityClientAdminPort clients() {
        return clients;
    }
}
