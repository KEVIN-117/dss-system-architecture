package uatf.dss.authservice.adapter.academiccontext;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mapstruct.factory.Mappers;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import uatf.dss.authservice.adapter.out.persistence.user.UserEntity;
import uatf.dss.authservice.adapter.out.persistence.useracademiccontext.AcademicContextMapper;
import uatf.dss.authservice.adapter.out.persistence.useracademiccontext.SpringDataUserAcademicContextRepository;
import uatf.dss.authservice.adapter.out.persistence.useracademiccontext.UserAcademicContextAdapter;
import uatf.dss.authservice.adapter.out.persistence.useracademiccontext.UserAcademicContextEntity;
import uatf.dss.authservice.domain.model.UserAcademicContext;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("UserAcademicContextAdapter Unit Tests")
class UserAcademicContextAdapterTest {

    @Mock
    private SpringDataUserAcademicContextRepository repository;

    private UserAcademicContextAdapter adapter;

    @BeforeEach
    void setUp() {
        AcademicContextMapper mapper = Mappers.getMapper(AcademicContextMapper.class);
        adapter = new UserAcademicContextAdapter(repository, mapper);
    }

    @Test
    @DisplayName("Should save academic context and map user ID correctly")
    void shouldSaveAcademicContext() {
        UUID userId = UUID.randomUUID();
        UserAcademicContext domain = new UserAcademicContext(null, userId, 5, 12);

        UUID generatedId = UUID.randomUUID();
        UserEntity userEntity = new UserEntity();
        userEntity.setId(userId);

        UserAcademicContextEntity savedEntity = new UserAcademicContextEntity(generatedId, 5, 12, userEntity);
        when(repository.save(any(UserAcademicContextEntity.class))).thenReturn(savedEntity);

        UserAcademicContext result = adapter.save(domain);

        assertNotNull(result);
        assertEquals(generatedId, result.id());
        assertEquals(userId, result.userId());
        assertEquals(5, result.facultyId());
        assertEquals(12, result.careerId());
        verify(repository).save(any(UserAcademicContextEntity.class));
    }

    @Test
    @DisplayName("Should find academic context by userId")
    void shouldFindByUserId() {
        UUID userId = UUID.randomUUID();
        UUID contextId = UUID.randomUUID();
        UserEntity userEntity = new UserEntity();
        userEntity.setId(userId);

        UserAcademicContextEntity entity = new UserAcademicContextEntity(contextId, 3, 9, userEntity);
        when(repository.findByUserId(userId)).thenReturn(Optional.of(entity));

        Optional<UserAcademicContext> result = adapter.findByUserId(userId);

        assertTrue(result.isPresent());
        assertEquals(contextId, result.get().id());
        assertEquals(userId, result.get().userId());
        assertEquals(3, result.get().facultyId());
        assertEquals(9, result.get().careerId());
    }

    @Test
    @DisplayName("Should delete academic context and return domain model")
    void shouldDelete() {
        UUID contextId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        UserEntity userEntity = new UserEntity();
        userEntity.setId(userId);

        UserAcademicContextEntity entity = new UserAcademicContextEntity(contextId, 1, 2, userEntity);
        when(repository.findById(contextId)).thenReturn(Optional.of(entity));

        Optional<UserAcademicContext> result = adapter.delete(contextId);

        assertTrue(result.isPresent());
        assertEquals(contextId, result.get().id());
        assertEquals(userId, result.get().userId());
        verify(repository).delete(entity);
    }

    @Test
    @DisplayName("Should return empty when deleting non-existent context")
    void shouldReturnEmptyWhenDeletingNonExistent() {
        UUID nonExistentId = UUID.randomUUID();
        when(repository.findById(nonExistentId)).thenReturn(Optional.empty());

        Optional<UserAcademicContext> result = adapter.delete(nonExistentId);

        assertFalse(result.isPresent());
        verify(repository, never()).delete(any());
    }
}
