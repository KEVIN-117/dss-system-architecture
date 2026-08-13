package uatf.dss.authservice.adapter.out.persistence.user;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import uatf.dss.authservice.domain.model.User;

@Mapper(componentModel = "spring")
interface UserPersistenceMapper {
    @Mapping(source = "isActive", target = "active")
    UserEntity toEntity(User domain);

    @Mapping(source = "active", target = "isActive")
    User toDomain(UserEntity entity);
}
