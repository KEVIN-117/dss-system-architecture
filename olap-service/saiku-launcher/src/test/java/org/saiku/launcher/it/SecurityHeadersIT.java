/*
 *   Copyright 2026 Spicule Ltd
 *   Apache License, Version 2.0.
 */
package org.saiku.launcher.it;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import java.net.http.HttpResponse;
import org.junit.BeforeClass;
import org.junit.Test;

/** Verifies always-on security headers on REST responses. */
public class SecurityHeadersIT {

    private static SaikuItHarness harness;

    @BeforeClass
    public static void boot() throws Exception {
        harness = SaikuItHarness.shared();
    }

    @Test
    public void alwaysOnHeadersPresentOnRestSurface() throws Exception {
        HttpResponse<String> resp = harness.getAnon("/rest/saiku/info");
        assertEquals("X-Content-Type-Options", "nosniff", header(resp, "X-Content-Type-Options"));
        assertTrue("Referrer-Policy present", header(resp, "Referrer-Policy").length() > 0);
        assertTrue(
                "Permissions-Policy present", header(resp, "Permissions-Policy").length() > 0);
    }

    private static String header(HttpResponse<String> resp, String name) {
        return resp.headers().firstValue(name).orElse("");
    }
}
