package uatf.dss.authservice.configuration;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import static org.assertj.core.api.Assertions.assertThat;

class WebhookSecretFilterConfigurationTest {

    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
            .withBean(WebhookSecretFilter.class);

    @Test
    void shouldFailToStartWhenWebhookSecretIsMissing() {
        contextRunner.run(context -> {
            assertThat(context).hasFailed();
            assertThat(context.getStartupFailure())
                    .hasRootCauseInstanceOf(IllegalStateException.class)
                    .hasRootCauseMessage("KEYCLOAK_WEBHOOK_SECRET must be configured");
        });
    }

    @Test
    void shouldStartWhenWebhookSecretIsConfigured() {
        contextRunner.withPropertyValues("app.security.webhook-secret=configured-secret")
                .run(context -> assertThat(context).hasSingleBean(WebhookSecretFilter.class));
    }
}
