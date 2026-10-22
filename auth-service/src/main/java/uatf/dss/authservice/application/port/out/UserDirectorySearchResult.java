package uatf.dss.authservice.application.port.out;

import uatf.dss.authservice.domain.model.User;

import java.util.List;

public record UserDirectorySearchResult(List<User> users, long totalElements, int totalPages) {
}
