package uatf.dss.authservice.user;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import uatf.dss.authservice.adapter.in.web.UserSyncController;
import uatf.dss.authservice.adapter.in.web.UserSyncRequest;
import uatf.dss.authservice.application.port.in.SyncUserCommand;
import uatf.dss.authservice.application.port.in.SyncUserUseCase;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class UserSyncControllerTest {

    @Mock
    private SyncUserUseCase syncUserUseCase;

    private UserSyncController controller;
    private static final String VALID_SECRET = "dss-webhook-secret-xyz123";
    private UserSyncRequest validRequest;

    @BeforeEach
    void setUp() {
        controller = new UserSyncController(syncUserUseCase, VALID_SECRET);
        validRequest = new UserSyncRequest(
                UUID.randomUUID().toString(),
                "uatf-dss-realm",
                "USER_CREATED",
                1234567890L,
                new UserSyncRequest.UserDto(
                        UUID.randomUUID(),
                        "krodriguez",
                        "krodriguez@uatf.edu.bo",
                        "Kevin",
                        "Rodriguez",
                        true
                )
        );
    }

    @Test
    void shouldReturnOkWhenTokenIsValid() {
        ResponseEntity<Void> response = controller.sync("Bearer " + VALID_SECRET, validRequest);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        verify(syncUserUseCase, times(1)).sync(any(SyncUserCommand.class));
    }

    @Test
    void shouldReturnUnauthorizedWhenTokenIsInvalid() {
        ResponseEntity<Void> response = controller.sync("Bearer wrong-secret", validRequest);

        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
        verify(syncUserUseCase, never()).sync(any());
    }

    @Test
    void shouldReturnUnauthorizedWhenHeaderIsMissing() {
        ResponseEntity<Void> response = controller.sync(null, validRequest);

        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
        verify(syncUserUseCase, never()).sync(any());
    }

    @Test
    void shouldReturnBadRequestWhenUserPayloadIsNull() {
        UserSyncRequest badRequest = new UserSyncRequest(
                UUID.randomUUID().toString(),
                "uatf-dss-realm",
                "USER_CREATED",
                1234567890L,
                null
        );

        ResponseEntity<Void> response = controller.sync("Bearer " + VALID_SECRET, badRequest);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        verify(syncUserUseCase, never()).sync(any());
    }

    @Test
    void shouldReturnBadRequestWhenKeycloakIdIsNull() {
        UserSyncRequest badRequest = new UserSyncRequest(
                UUID.randomUUID().toString(),
                "uatf-dss-realm",
                "USER_CREATED",
                1234567890L,
                new UserSyncRequest.UserDto(
                        null,
                        "krodriguez",
                        "krodriguez@uatf.edu.bo",
                        "Kevin",
                        "Rodriguez",
                        true
                )
        );

        ResponseEntity<Void> response = controller.sync("Bearer " + VALID_SECRET, badRequest);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        verify(syncUserUseCase, never()).sync(any());
    }
}
