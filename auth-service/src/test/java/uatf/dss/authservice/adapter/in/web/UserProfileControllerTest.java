package uatf.dss.authservice.adapter.in.web;

import org.junit.jupiter.api.Test;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import uatf.dss.authservice.application.port.in.AuthUserProfile;
import uatf.dss.authservice.application.port.in.GetAuthUserProfileCommand;
import uatf.dss.authservice.application.port.in.GetAuthUserProfileUseCase;

import java.util.Collections;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = UserProfileController.class)
class UserProfileControllerTest extends BaseWebMvcTest {

    @MockitoBean
    private GetAuthUserProfileUseCase authUserProfileUseCase;

    @Test
    void whenUnauthenticated_thenStatus401() throws Exception {
        mockMvc.perform(get("/auth/me"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void whenAuthenticated_thenReturnUserProfile() throws Exception {
        // Arrange
        UUID keycloakId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        
        AuthUserProfile mockProfile = new AuthUserProfile(
                userId,
                "testuser",
                "test@uatf.edu.bo",
                "Test",
                "User",
                true,
                Collections.emptyList()
        );

        when(authUserProfileUseCase.execute(any(GetAuthUserProfileCommand.class)))
                .thenReturn(mockProfile);

        // Act & Assert
        mockMvc.perform(get("/auth/me")
                        .with(jwt().jwt(jwt -> jwt.subject(keycloakId.toString()))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(userId.toString()))
                .andExpect(jsonPath("$.username").value("testuser"))
                .andExpect(jsonPath("$.email").value("test@uatf.edu.bo"))
                .andExpect(jsonPath("$.firstName").value("Test"))
                .andExpect(jsonPath("$.lastName").value("User"))
                .andExpect(jsonPath("$.isActive").value(true));

        verify(authUserProfileUseCase).execute(new GetAuthUserProfileCommand(keycloakId));
    }
}
