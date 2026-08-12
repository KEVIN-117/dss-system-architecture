package uatf.dss.authservice;

import org.springframework.boot.SpringApplication;
import uatf.dss.authservice.AuthServiceApplication;

public class TestAuthServiceApplication {

    public static void main(String[] args) {
        SpringApplication.from(AuthServiceApplication::main).with(TestcontainersConfiguration.class).run(args);
    }

}
