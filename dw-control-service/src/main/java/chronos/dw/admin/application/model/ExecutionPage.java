package chronos.dw.admin.application.model;

import java.util.List;

public record ExecutionPage<T>(List<T> items, int page, int size, long totalElements, long totalPages) {

    public ExecutionPage {
        items = List.copyOf(items);
    }
}
