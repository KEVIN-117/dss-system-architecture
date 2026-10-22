package chronos.dw.admin;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

@ActiveProfiles("test")
@SpringBootTest(
        properties = {
            "spring.datasource.url=jdbc:h2:mem:dwcontrol;DB_CLOSE_DELAY=-1",
            "spring.datasource.username=sa",
            "spring.datasource.password=",
            "app.security.jwt.issuer-uri=http://localhost:8080/realms/uatf-dss-realm",
            "app.security.jwt.jwk-set-uri=http://localhost:8080/realms/uatf-dss-realm/protocol/openid-connect/certs",
            "app.security.jwt.audience=dw-control-service",
            "app.security.jwt.client-id=dw-control-service"
        })
class DwControlServiceApplicationTests {

    @Test
    void contextLoads() {}
}
