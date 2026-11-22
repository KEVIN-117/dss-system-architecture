package chronos.dw.admin.configuration;

import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.util.Base64;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

/** Wiring of the Load Manager: Hop Server HTTP client and clock. */
@Configuration
@EnableConfigurationProperties(EtlProperties.class)
public class LoadManagerConfiguration {

    private static final Logger LOG = LoggerFactory.getLogger(LoadManagerConfiguration.class);

    @Bean
    RestClient hopServerRestClient(RestClient.Builder builder, EtlProperties properties) {
        EtlProperties.Hop hop = properties.hop();
        HttpClient httpClient = HttpClient.newBuilder()
                .connectTimeout(hop.connectTimeout())
                .followRedirects(HttpClient.Redirect.NEVER)
                .build();
        JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(httpClient);
        requestFactory.setReadTimeout(hop.readTimeout());

        RestClient.Builder configured =
                builder.clone().baseUrl(hop.baseUrl().toString()).requestFactory(requestFactory);
        if (!applyCredentials(configured, hop)) {
            LOG.warn("Hop Server credentials (app.etl.hop.username/password) are not configured; "
                    + "Load Manager executions will fail until they are set");
        }
        return configured.build();
    }

    /**
     * Adds the Hop Server Basic Auth header.
     *
     * @return whether credentials were configured
     */
    public static boolean applyCredentials(RestClient.Builder builder, EtlProperties.Hop hop) {
        if (!hop.hasCredentials()) {
            return false;
        }
        String token = Base64.getEncoder()
                .encodeToString((hop.username() + ":" + hop.password()).getBytes(StandardCharsets.UTF_8));
        builder.defaultHeader(HttpHeaders.AUTHORIZATION, "Basic " + token);
        return true;
    }

    @Bean
    @ConditionalOnMissingBean
    Clock loadManagerClock() {
        return Clock.systemUTC();
    }
}
