package uatf.dss.authservice.adapter.out.persistence.exampleuser;

import org.mapstruct.Mapper;
import uatf.dss.authservice.domain.model.ExampleUser;

@Mapper
interface ExampleUserPersistenceMapper {
    ExampleUserEntity toEntity(ExampleUser domain);
    ExampleUser toDomain(ExampleUserEntity entity);
}
