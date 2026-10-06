package uatf.dss.authservice.adapter.out.persistence.useracademiccontext;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import uatf.dss.authservice.adapter.out.persistence.user.UserEntity;

import java.util.UUID;

@Entity
@Table(name = "user_academic_contexts")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class UserAcademicContextEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "faculty_id", nullable = true)
    private Integer facultyId;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "career_id", nullable = true, length = 3, columnDefinition = "char(3)")
    private String careerId;

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    private UserEntity user;
}
