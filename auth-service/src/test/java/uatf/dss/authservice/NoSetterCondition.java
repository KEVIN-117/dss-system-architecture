package uatf.dss.authservice;

import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.domain.JavaMethod;
import com.tngtech.archunit.lang.ArchCondition;
import com.tngtech.archunit.lang.ConditionEvents;
import com.tngtech.archunit.lang.SimpleConditionEvent;

public class NoSetterCondition extends ArchCondition<JavaClass> {

    public NoSetterCondition() {
        super("not have setters");
    }

    @Override
    public void check(JavaClass item, ConditionEvents events) {
        for (JavaMethod method : item.getAllMethods()){
            if (method.getName().startsWith("set")){
                String message = String.format(
                        "Class %s has a setter method: %s",
                        item.getName(),
                        method.getName()
                );
                events.add(SimpleConditionEvent.violated(method, message));
            }
        }
    }
}
