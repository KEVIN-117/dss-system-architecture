package uatf.dss.authservice;

import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.lang.ArchRule;
import org.junit.jupiter.api.Test;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

public class ArchitectureTest {

    // 1. El Dominio debe ser completamente independiente de otras capas
    @Test
    void domainShouldNotDependOnOtherLayers() {
        ArchRule rule = noClasses()
                .that().resideInAPackage("..domain..")
                .should().dependOnClassesThat()
                .resideInAnyPackage("..application..", "..adapter..", "..configuration..");

        rule.check(new ClassFileImporter().importPackages("uatf.dss.authservice"));
    }

    // 2. La capa de Aplicación solo puede depender de Dominio (no de adaptadores ni config)
    @Test
    void applicationShouldOnlyDependOnDomain() {
        ArchRule rule = noClasses()
                .that().resideInAPackage("..application..")
                .should().dependOnClassesThat()
                .resideInAnyPackage("..adapter..", "..configuration..");

        rule.check(new ClassFileImporter().importPackages("uatf.dss.authservice"));
    }

    // 3. Ni el Dominio ni la Aplicación deben usar anotaciones o dependencias de Spring
    @Test
    void domainAndApplicationShouldNotUseSpring() {
        ArchRule rule = noClasses()
                .that().resideInAnyPackage("..domain..", "..application..")
                .should().dependOnClassesThat()
                .resideInAnyPackage("org.springframework..");

        rule.check(new ClassFileImporter().importPackages("uatf.dss.authservice"));
    }
}
