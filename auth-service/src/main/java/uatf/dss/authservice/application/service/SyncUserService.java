package uatf.dss.authservice.application.service;

import jakarta.transaction.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import uatf.dss.authservice.application.port.in.SyncUserCommand;
import uatf.dss.authservice.application.port.in.SyncUserUseCase;
import uatf.dss.authservice.application.port.out.UserRepository;
import uatf.dss.authservice.domain.model.User;
import uatf.dss.authservice.domain.model.RoleType;

import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

import static net.logstash.logback.argument.StructuredArguments.kv;

public class SyncUserService implements SyncUserUseCase {

    private static final Logger AUDIT_LOGGER = LoggerFactory.getLogger("AUDIT_LOGGER");
    private final UserRepository userRepository;

    public SyncUserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    @Transactional
    public User sync(SyncUserCommand command) {
        Set<String> applicationRoles = command.roles() == null
                ? null
                : command.roles().stream()
                        .filter(role -> !role.clientRole())
                        .map(role -> normalizeApplicationRole(role.name()))
                        .filter(role -> role != null)
                        .collect(Collectors.toSet());

        User savedUser = userRepository.findByKeycloakId(command.keycloakId())
                .map(existingUser -> {
                    User updatedUser = User.create(
                            existingUser.id(),
                            existingUser.keycloakId(),
                            command.username(),
                            command.email(),
                            command.firstName(),
                            command.lastName(),
                            command.isActive()
                    );
                    return userRepository.save(updatedUser);
                })
                .orElseGet(() -> {
                    User newUser = User.create(
                            null,
                            command.keycloakId(),
                            command.username(),
                            command.email(),
                            command.firstName(),
                            command.lastName(),
                            command.isActive()
                    );
                    return userRepository.save(newUser);
                });

        if (applicationRoles != null) {
            userRepository.replaceRoleSnapshot(savedUser.id(), applicationRoles);
        }

        AUDIT_LOGGER.info("Sincronización de Perfil de Usuario",
                kv("event_type", "USER_SYNCED"),
                kv("keycloak_id", savedUser.keycloakId()),
                kv("username", savedUser.username()),
                kv("roles", applicationRoles == null ? "snapshot not provided" : applicationRoles));

        return savedUser;
    }

    private static String normalizeApplicationRole(String roleName) {
        if (roleName == null || roleName.isBlank()) {
            return null;
        }
        String normalized = roleName.trim().toUpperCase(Locale.ROOT);
        if (normalized.startsWith("ROLE_")) {
            normalized = normalized.substring("ROLE_".length());
        }
        try {
            return RoleType.valueOf(normalized).name();
        } catch (IllegalArgumentException ignored) {
            return null;
        }
    }
}
