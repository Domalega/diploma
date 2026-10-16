package com.domalega.daymark;
import org.json.*;
import org.junit.Test;
import static org.junit.Assert.*;

public class SyncMergeTest {
    @Test public void unrelatedChangesAndDeletesMerge() throws Exception {
        JSONObject base = new JSONObject("{a:{title:'old'},b:{title:'keep'}}");
        JSONObject local = new JSONObject("{b:{title:'keep'},c:{title:'phone'}}");
        JSONObject remote = new JSONObject("{a:{title:'old'},b:{title:'web'}}");
        JSONObject merged = SyncMerge.merge(base, local, remote, false);
        assertEquals(0, merged.getJSONArray("conflicts").length());
        assertFalse(merged.getJSONObject("state").has("a"));
        assertEquals("web", merged.getJSONObject("state").getJSONObject("b").getString("title"));
        assertEquals("phone", merged.getJSONObject("state").getJSONObject("c").getString("title"));
    }
    @Test public void editVersusDeleteRequiresAnExplicitChoice() throws Exception {
        JSONObject base = new JSONObject("{a:{title:'old'}}"), local = new JSONObject(), remote = new JSONObject("{a:{title:'web'}}");
        assertEquals("a", SyncMerge.merge(base, local, remote, false).getJSONArray("conflicts").getString(0));
        assertFalse(SyncMerge.merge(base, local, remote, false).getJSONObject("state").has("a"));
        assertEquals("web", SyncMerge.merge(base, local, remote, true).getJSONObject("state").getJSONObject("a").getString("title"));
    }
    @Test public void inFlightChangesSurviveAServerReplyAndPropertyOrderIsIrrelevant() throws Exception {
        JSONObject uploaded = new JSONObject("{a:{title:'sent',completed:false}}"), current = new JSONObject("{a:{completed:true,title:'sent'},b:{title:'new'}}"), response = new JSONObject("{a:{completed:false,title:'sent'},c:{title:'web'}}");
        JSONObject result = SyncMerge.merge(uploaded, current, response, false);
        assertEquals(0, result.getJSONArray("conflicts").length());
        assertTrue(result.getJSONObject("state").getJSONObject("a").getBoolean("completed"));
        assertTrue(result.getJSONObject("state").has("b")); assertTrue(result.getJSONObject("state").has("c"));
        assertTrue(SyncMerge.equal(new JSONObject("{a:1,b:null}"), new JSONObject("{b:null,a:1}")));
    }
}
