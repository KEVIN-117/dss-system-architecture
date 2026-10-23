package chronos.dw.admin.application.model;

import java.util.List;

/** Page metadata and items returned by closure queries. */
public record ClosurePage<T>(List<T> items, int page, int size, long totalElements, long totalPages) {

    public ClosurePage {
        items = List.copyOf(items);
    }
}
