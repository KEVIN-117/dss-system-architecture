package uatf.dss.authservice.adapter.out.persistence.useracademiccontext;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import uatf.dss.authservice.domain.model.UserAcademicContext;

@Mapper(componentModel = "spring")
public interface AcademicContextMapper {
    @Mapping(target = "user.id", source = "userId")
    UserAcademicContextEntity toEntity(UserAcademicContext domain);

    @Mapping(target = "userId", source = "user.id")
    UserAcademicContext toDomain(UserAcademicContextEntity entity);
}
