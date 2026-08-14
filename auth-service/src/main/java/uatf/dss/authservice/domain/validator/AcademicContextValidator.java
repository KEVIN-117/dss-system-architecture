package uatf.dss.authservice.domain.validator;

import uatf.dss.authservice.domain.exception.InvalidDeanAcademicContextException;
import uatf.dss.authservice.domain.exception.InvalidDirectorAcademicContextException;
import uatf.dss.authservice.domain.exception.InvalidRectorAcademicContextException;
import uatf.dss.authservice.domain.model.RoleType;
import uatf.dss.authservice.domain.model.UserAcademicContext;

public class AcademicContextValidator {
    public static void validate(UserAcademicContext context, RoleType role){
        switch (role){
            case RECTOR, SUPERADMIN -> {
                if (context.facultyId() != null || context.careerId() != null){
                    throw new InvalidRectorAcademicContextException();
                }
            }
            case DECANO -> {
                if (context.facultyId() == null || context.careerId() != null){
                    throw new InvalidDeanAcademicContextException();
                }
            }
            case DIRECTOR -> {
                if (context.facultyId() == null || context.careerId() == null){
                    throw new InvalidDirectorAcademicContextException();
                }
            }
        }
    }
}
