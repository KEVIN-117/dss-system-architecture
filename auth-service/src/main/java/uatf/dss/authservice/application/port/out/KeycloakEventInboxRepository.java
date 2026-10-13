package uatf.dss.authservice.application.port.out;

public interface KeycloakEventInboxRepository {
    /** Marks an event as processed if it has not been seen before. */
    boolean markAsProcessed(String eventId);
}
