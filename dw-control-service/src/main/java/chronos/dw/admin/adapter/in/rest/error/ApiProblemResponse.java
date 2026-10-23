package chronos.dw.admin.adapter.in.rest.error;

import jakarta.servlet.http.HttpServletRequest;

/** Stable RFC 9457 problem response shared by MVC and Spring Security. */
public record ApiProblemResponse(String type, String title, int status, String detail, String instance, String code) {

    public static ApiProblemResponse forRequest(
            int status, String title, String detail, String code, HttpServletRequest request) {
        return new ApiProblemResponse("about:blank", title, status, detail, request.getRequestURI(), code);
    }
}
