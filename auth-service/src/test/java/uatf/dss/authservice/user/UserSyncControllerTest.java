package uatf.dss.authservice.user;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Import;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import uatf.dss.authservice.adapter.in.web.UserSyncController;
import uatf.dss.authservice.application.port.in.SyncUserCommand;
import uatf.dss.authservice.application.port.in.SyncUserUseCase;
import uatf.dss.authservice.configuration.JwtConverter;
import uatf.dss.authservice.configuration.SecurityConfig;
import uatf.dss.authservice.configuration.WebhookSecretFilter;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = UserSyncController.class)
@Import({SecurityConfig.class, WebhookSecretFilter.class, JwtConverter.class})
@ActiveProfiles("test")
public class UserSyncControllerTest {

    @MockitoBean
    private SyncUserUseCase syncUserUseCase;

    @MockitoBean
    private JwtDecoder jwtDecoder;

    @Value("${app.security.webhook-secret}")
    private String expectedSecret;

    @Autowired
    private MockMvc mockMvc;

    @Test
    void shouldReturnOkWhenTokenIsValid() throws Exception {
        mockMvc.perform(post("/auth/sync")
                        .header("X-Webhook-Secret", expectedSecret)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                    {
                        "eventId": "some-event-id",
                        "realmId": "uatf-dss-realm",
                        "eventType": "USER_CREATED",
                        "timestamp": 123456789,
                        "user": {
                        "keycloakId": "22222222-2222-2222-2222-222222222222",
                        "username": "johndoe",
                        "email": "john.doe@example.com",
                        "firstName": "John",
                        "lastName": "Doe",
                        "isActive": true
                      }
                    }
                """))
                .andExpect(status().isOk());

        verify(syncUserUseCase).sync(any(SyncUserCommand.class));
    }

    @Test
    void shouldReturnUnauthorizedWhenTokenIsInvalid() throws Exception {
        mockMvc.perform(post("/auth/sync")
                        .header("X-Webhook-Secret", "wrong-secret")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                    {
                        "eventId": "some-event-id",
                        "realmId": "uatf-dss-realm",
                        "eventType": "USER_CREATED",
                        "timestamp": 123456789,
                        "user": {
                        "keycloakId": "22222222-2222-2222-2222-222222222222",
                        "username": "johndoe",
                        "email": "john.doe@example.com",
                        "firstName": "John",
                        "lastName": "Doe",
                        "isActive": true
                      }
                    }
                """))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void shouldReturnUnauthorizedWhenHeaderIsMissing() throws Exception {
        mockMvc.perform(post("/auth/sync")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {
                            "user": {
                                "keycloakId": "22222222-2222-2222-2222-222222222222",
                                "username": "johndoe",
                                "email": "john.doe@example.com",
                                "firstName": "John",
                                "lastName": "Doe",
                                "isActive": true
                            }
                        }
                """)).andExpect(status().isUnauthorized());
    }

    @Test
    void shouldReturnBadRequestWhenUserPayloadIsNull() throws Exception {
        mockMvc.perform(post("/auth/sync")
                        .header("X-Webhook-Secret", expectedSecret)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                    {
                        "eventId": "some-event-id",
                        "realmId": "uatf-dss-realm",
                        "eventType": "USER_CREATED",
                        "timestamp": 123456789,
                        "user": {
                        "username": "johndoe",
                        "email": "john.doe@example.com",
                        "firstName": "John",
                        "lastName": "Doe",
                        "isActive": true
                      }
                    }
                """))
                .andExpect(status().isBadRequest());
    }

    @Test
    void shouldReturnBadRequestWhenKeycloakIdIsNull() throws Exception {
        mockMvc.perform(post("/auth/sync")
                        .header("X-Webhook-Secret", expectedSecret)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                    {
                      "user": {
                        "username": "johndoe",
                        "email": "john.doe@example.com",
                        "firstName": "John",
                        "lastName": "Doe",
                        "isActive": true
                      }
                    }
                """))
                .andExpect(status().isBadRequest());
    }
}
