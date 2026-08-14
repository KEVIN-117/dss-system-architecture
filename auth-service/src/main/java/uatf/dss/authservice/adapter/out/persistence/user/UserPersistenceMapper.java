package uatf.dss.authservice.adapter.out.persistence.user;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import uatf.dss.authservice.domain.model.User;
import uatf.dss.authservice.domain.model.Email;

@Mapper(componentModel = "spring")
interface UserPersistenceMapper {
    @Mapping(source = "isActive", target = "active")
    UserEntity toEntity(User domain);

    @Mapping(source = "active", target = "isActive")
    User toDomain(UserEntity entity);

    default String map(Email value) {
        return value != null ? value.email() : null;
    }

    default Email map(String value) {
        return value != null ? new Email(value) : null;
    }
}
