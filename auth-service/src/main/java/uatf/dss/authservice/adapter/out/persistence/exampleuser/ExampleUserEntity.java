package uatf.dss.authservice.adapter.out.persistence.exampleuser;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "example_users")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
class ExampleUserEntity {
    @Id
    private String id;
    private String email;
}
