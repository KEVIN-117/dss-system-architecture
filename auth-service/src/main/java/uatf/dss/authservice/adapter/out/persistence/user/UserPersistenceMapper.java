package uatf.dss.authservice.adapter.out.persistence.user;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;
import uatf.dss.authservice.domain.model.User;
import uatf.dss.authservice.domain.model.Email;

@Mapper(componentModel = "spring")
public interface UserPersistenceMapper {
    @Mapping(source = "isActive", target = "active")
    UserEntity toEntity(User domain);

    @Mapping(source = "active", target = "isActive")
    User toDomain(UserEntity entity);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "keycloakId", ignore = true)
    @Mapping(source = "isActive", target = "active")
    @Mapping(target = "roles", ignore = true)
    @Mapping(target = "academicContexts", ignore = true)
    void updateEntity(User domain, @MappingTarget UserEntity entity);

    default String map(Email value) {
        return value != null ? value.email() : null;
    }

    default Email map(String value) {
        return value != null ? new Email(value) : null;
    }
}
