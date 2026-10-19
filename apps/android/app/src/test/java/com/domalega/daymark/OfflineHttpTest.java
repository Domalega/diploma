package com.domalega.daymark;

import org.junit.Test;
import static org.junit.Assert.*;

public class OfflineHttpTest {
    @Test public void onlySyncAuthenticationAndBoundedHistoryRoutesAreAllowed() {
        String history = "/kanban/tasks/10000000-0000-4000-8000-000000000001/history?limit=";
        for (String path : new String[]{"/user/auth", "/user/login", "/sync", "/sync?history=none", history + "1", history + "50&before=100", history + "100"})
            assertTrue(path, OfflineHttp.supportedPath(path));
        for (String path : new String[]{"/sync?history=none&extra=1", "/user/auth?token=secret", "/user/../sync", "/user/auth#fragment", "/kanban", history + "101", history + "0", history + "50&before=1.2", history + "50&before=-1", "https://other.test/sync"})
            assertFalse(path, OfflineHttp.supportedPath(path));
    }
}
