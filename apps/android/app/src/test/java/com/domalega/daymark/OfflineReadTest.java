package com.domalega.daymark;

import org.json.*;
import org.junit.Test;
import static org.junit.Assert.*;

public class OfflineReadTest {
    private JSONObject document() throws Exception {
        return new JSONObject("{owner:'7',generation:4,credential:'never expose',base:{secret:'baseline'},history:{task:[{id:1}]},state:{todos:{enabled:true},board:{enabled:true,columns:[]},medications:{enabled:true,rows:[],slots:[]},'note/n':{date:'2026-10-19',comment:'Note'},'todo/t':{title:'Todo'},'task/k':{title:'Card'},'intake/2026-10-19/m/s':{date:'2026-10-19'},'intake/2026-10-20/m/s':{date:'2026-10-20'}}}");
    }
    @Test public void bridgeReadsExposeOnlyTheRequestedSection() throws Exception {
        JSONObject doc = document();
        JSONObject notes = OfflineRead.project(doc, "/userDate/get");
        assertEquals(1, notes.getJSONObject("state").length());
        assertTrue(notes.getJSONObject("state").has("note/n"));
        for (String path : new String[]{"/todos", "/kanban", "/medications/plan", "/state"}) {
            JSONObject projected = OfflineRead.project(doc, path);
            assertFalse(projected.has("credential")); assertFalse(projected.has("base")); assertFalse(projected.has("history"));
            assertEquals("7", projected.getString("owner")); assertEquals(4, projected.getLong("generation"));
        }
        assertEquals(2, OfflineRead.project(doc, "/todos").getJSONObject("state").length());
        assertEquals(2, OfflineRead.project(doc, "/kanban").getJSONObject("state").length());
        assertEquals(1, OfflineRead.project(doc, "/medications/plan").getJSONObject("state").length());
    }
    @Test public void intakeReadsExcludeOtherDays() throws Exception {
        JSONObject state = OfflineRead.project(document(), "/medications/intakes?date=2026-10-19").getJSONObject("state");
        assertEquals(1, state.length());
        assertTrue(state.has("intake/2026-10-19/m/s"));
    }
    @Test public void unrelatedLargeSectionsNeverCrossTheBridge() throws Exception {
        JSONObject doc = document(), events = doc.getJSONObject("history");
        JSONArray large = new JSONArray();
        for (int i = 0; i < 10000; i++) large.put(new JSONObject().put("id", i).put("details", "x".repeat(100)));
        events.put("long-history", large);
        for (int i = 0; i < 2000; i++) doc.getJSONObject("state").put("note/" + i, new JSONObject().put("comment", "n".repeat(100)));
        int fullSize = doc.toString().length();
        int todoSize = OfflineRead.project(doc, "/todos").toString().length();
        assertTrue(fullSize > 1000000);
        assertTrue(todoSize < 300);
    }
    @Test public void unknownReadsAndMissingSnapshotsAreRejected() throws Exception {
        try { OfflineRead.project(document(), "/credential"); fail("Unknown projection"); } catch (JSONException expected) { }
        try { OfflineRead.project(new JSONObject(), "/todos"); fail("Missing snapshot"); } catch (IllegalStateException expected) { }
    }
}
