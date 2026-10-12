package uatf.keycloak;

import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertTrue;

class RealmListenerConfigurationTest {
    @Test
    void realmExportEnablesAdministrativeEventsAndRegistersProvider() throws Exception {
        Path realmExport = Path.of("..", "infra", "keycloak", "realm", "uatf-dss-realm-realm.json");
        String realm = Files.readString(realmExport);

        assertTrue(realm.contains("\"eventsEnabled\": true"));
        assertTrue(realm.contains("\"adminEventsEnabled\": true"));
        assertTrue(realm.contains("\"adminEventsDetailsEnabled\": true"));
        int listenersStart = realm.indexOf("\"eventsListeners\"");
        int listenersEnd = realm.indexOf(']', listenersStart);
        assertTrue(listenersStart >= 0 && listenersEnd > listenersStart);
        assertTrue(realm.substring(listenersStart, listenersEnd).contains("\"uatf-webhook\""));
        assertTrue(realm.substring(listenersStart, listenersEnd)
                .contains("\"" + new WebhookEventListenerProviderFactory().getId() + "\""));
    }
}
