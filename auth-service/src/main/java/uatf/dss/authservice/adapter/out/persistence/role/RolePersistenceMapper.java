package uatf.dss.authservice.adapter.out.persistence.role;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import uatf.dss.authservice.domain.model.Role;

@Mapper(componentModel = "spring")
public interface RolePersistenceMapper {
    RoleEntity toEntity(Role domain);

    Role toDomain(RoleEntity entity);
}
