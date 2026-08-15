package uatf.dss.authservice.adapter.out.persistence.role;

import org.springframework.stereotype.Repository;
import uatf.dss.authservice.application.port.out.RoleRepository;
import uatf.dss.authservice.domain.model.Role;

import java.util.List;
import java.util.Optional;

@Repository
public class RoleRepositoryAdapter implements RoleRepository {

    private final SpringDataRoleRepository springDataRepository;
    private final RolePersistenceMapper mapper;

    public RoleRepositoryAdapter(SpringDataRoleRepository springDataRepository, RolePersistenceMapper mapper){
        this.springDataRepository = springDataRepository;
        this.mapper = mapper;
    }

    @Override
    public Optional<Role> findByName(String name) {
        return springDataRepository.findByName(name).map(mapper::toDomain);
    }

    @Override
    public List<Role> listAll() {
        return springDataRepository.findAll().stream().map(mapper::toDomain).toList();
    }
}
