package uatf.dss.authservice.adapter.in.web;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.context.annotation.Import;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.web.servlet.MockMvc;
import uatf.dss.authservice.configuration.JwtConverter;
import uatf.dss.authservice.configuration.SecurityConfig;

@Import({SecurityConfig.class, JwtConverter.class})
@ActiveProfiles("test")
public abstract class BaseWebMvcTest {

    @Autowired
    protected MockMvc mockMvc;

    @MockitoBean
    protected JwtDecoder jwtDecoder;
}
