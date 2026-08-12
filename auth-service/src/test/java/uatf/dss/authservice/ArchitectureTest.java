package uatf.dss.authservice;

import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.lang.ArchRule;
import org.junit.jupiter.api.Test;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;
import static com.tngtech.archunit.library.dependencies.SlicesRuleDefinition.slices;

public class ArchitectureTest {

    private static final String BASE_PACKAGE = "uatf.dss.authservice";

    private JavaClasses importArchitectureClasses() {
        return new ClassFileImporter().importPackages(BASE_PACKAGE);
    }

    // 1. El Dominio debe ser completamente independiente de otras capas
    @Test
    void domainShouldNotDependOnOtherLayers() {
        ArchRule rule = noClasses()
                .that().resideInAPackage("..domain..")
                .should().dependOnClassesThat()
                .resideInAnyPackage("..application..", "..adapter..", "..configuration..");

        rule.check(importArchitectureClasses());
    }

    // 2. Los casos de uso (application) solo deben depender del dominio y no de infraestructura (adapter) ni configuración
    @Test
    void applicationShouldOnlyDependOnDomain() {
        ArchRule rule = noClasses()
                .that().resideInAPackage("..application..")
                .should().dependOnClassesThat()
                .resideInAnyPackage("..adapter..", "..configuration..");

        rule.check(importArchitectureClasses());
    }

    // 3. Los adaptadores no deben depender de la capa de configuración (inyección de dependencias centralizada)
    @Test
    void adaptersShouldNotDependOnConfiguration() {
        ArchRule rule = noClasses()
                .that().resideInAPackage("..adapter..")
                .should().dependOnClassesThat()
                .resideInAnyPackage("..configuration..");

        rule.check(importArchitectureClasses());
    }

    // 4. Los adaptadores específicos no deben depender entre sí (ej. web no debe depender de persistencia)
    @Test
    void adaptersShouldNotDependOnEachOther() {
        slices().matching("uatf.dss.authservice.adapter.*.(*)..")
                .should().notDependOnEachOther()
                .check(importArchitectureClasses());
    }

    // 5. La configuración solo debe crear/wire beans de aplicación y adaptadores,
    //    evitando tipos del web layer/controladores directamente
    @Test
    void configurationShouldNotDependOnWebLayer() {
        ArchRule rule = noClasses()
                .that().resideInAPackage("..configuration..")
                .should().dependOnClassesThat()
                .resideInAnyPackage("..adapter.in.web..", "..controller..", "..rest..");

        rule.check(importArchitectureClasses());
    }

    // 6. Los controladores deben depender de puertos de entrada (Use Cases)
    @Test
    void controllersShouldDependOnInputPorts() {
        ArchRule rule = classes()
                .that().resideInAPackage("..adapter.in.web..")
                .and().haveSimpleNameEndingWith("Controller")
                .should().dependOnClassesThat()
                .resideInAnyPackage("..application.port.in..");

        rule.check(importArchitectureClasses());
    }

    // 7. Los controladores no deben saltarse la aplicación y depender de puertos de salida directamente
    @Test
    void controllersShouldNotDependOnOutputPorts() {
        ArchRule rule = noClasses()
                .that().resideInAPackage("..adapter.in.web..")
                .should().dependOnClassesThat()
                .resideInAnyPackage("..application.port.out..");

        rule.check(importArchitectureClasses());
    }
}
