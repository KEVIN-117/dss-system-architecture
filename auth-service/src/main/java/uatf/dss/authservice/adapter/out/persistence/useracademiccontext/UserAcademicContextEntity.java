package uatf.dss.authservice.adapter.out.persistence.useracademiccontext;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
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

    @Column(name = "career_id", nullable = true)
    private Integer careerId;

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    private UserEntity user;
}
