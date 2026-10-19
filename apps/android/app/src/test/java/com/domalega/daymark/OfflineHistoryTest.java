package com.domalega.daymark;

import org.json.*;
import org.junit.Test;
import static org.junit.Assert.*;

public class OfflineHistoryTest {
    @Test public void cachedPagesAreSortedDeduplicatedAndUseExclusiveCursors() throws Exception {
        JSONArray previous = new JSONArray("[{id:8},{id:6},{id:7}]"), incoming = new JSONArray("[{id:9},{id:8,details:'new'}]");
        JSONArray merged = OfflineHistory.merge(previous, incoming);
        assertEquals(4, merged.length());
        assertEquals(9, merged.getJSONObject(0).getLong("id"));
        assertEquals("new", merged.getJSONObject(1).getString("details"));
        JSONObject first = OfflineHistory.page(merged, 0, 2);
        assertEquals(8, first.getLong("nextCursor"));
        JSONObject next = OfflineHistory.page(merged, first.getLong("nextCursor"), 2);
        assertEquals(7, next.getJSONArray("events").getJSONObject(0).getLong("id"));
        assertEquals(6, next.getJSONArray("events").getJSONObject(1).getLong("id"));
        assertTrue(next.isNull("nextCursor"));
    }
    @Test public void emptyCachesAreValidAndDeletedTasksLoseTheirCachedHistory() throws Exception {
        JSONObject empty = OfflineHistory.page(null, 0, 50);
        assertEquals(0, empty.getJSONArray("events").length());
        assertTrue(empty.isNull("nextCursor"));
        JSONObject doc = new JSONObject("{state:{'task/kept':{}},history:{kept:[{id:1}],deleted:[{id:2}]}}");
        OfflineHistory.prune(doc);
        assertEquals(1, doc.getJSONObject("history").length());
        assertTrue(doc.getJSONObject("history").has("kept"));
    }
}
