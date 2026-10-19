package com.domalega.daymark;
import org.junit.Test;
import org.json.*;
import java.time.*;
import static org.junit.Assert.*;

public class ScheduleTest {
    JSONObject plan() throws Exception {
        return new JSONObject("{\"version\":1,\"owner\":\"1\",\"marks\":{},\"rules\":[{\"id\":\"med:1:am\",\"kind\":\"medication\",\"startDate\":\"2026-10-01\",\"endDate\":null,\"time\":\"08:00\",\"weekdays\":[1,3,5],\"title\":\"Reminder\",\"body\":\"Example\"}]}");
    }
    ZonedDateTime date(String local) { return LocalDateTime.parse(local).atZone(ZoneId.of("Asia/Novosibirsk")); }
    @Test public void followsWeekdaysAndKeepsRecurringWithoutServer() throws Exception {
        JSONObject p = Schedule.validate(plan());
        assertEquals(date("2026-10-16T08:00"), Schedule.next(p, date("2026-10-15T12:00")));
        assertEquals(date("2026-10-19T08:00"), Schedule.next(p, date("2026-10-16T08:00")));
        assertEquals(1, Schedule.at(p, date("2026-10-16T08:00")).size());
        assertTrue(Schedule.at(p, date("2026-10-17T08:00")).isEmpty());
    }
    @Test public void respectsMarksCourseEndAndOneTimeNotes() throws Exception {
        JSONObject p = plan();
        p.getJSONObject("marks").put("2026-10-16", new JSONArray().put("med:1:am"));
        assertEquals(date("2026-10-19T08:00"), Schedule.next(p, date("2026-10-15T12:00")));
        p.getJSONArray("rules").getJSONObject(0).put("endDate", "2026-10-17");
        assertNull(Schedule.next(p, date("2026-10-15T12:00")));
        JSONObject note = p.getJSONArray("rules").getJSONObject(0);
        note.put("id", "note:1").put("kind", "note").put("startDate", "2026-10-16").put("endDate", "2026-10-16");
        assertEquals(date("2026-10-16T08:00"), Schedule.next(p, date("2026-10-15T12:00")));
        assertNull(Schedule.next(p, date("2026-10-16T08:00")));
    }
    @Test public void preservesFutureMarksButSeparatesAccounts() throws Exception {
        JSONObject p = plan(), fresh = plan();
        p.getJSONObject("marks").put("2099-01-01", new JSONArray().put("med:1:am"));
        assertTrue(Schedule.merge(p, fresh).getJSONObject("marks").has("2099-01-01"));
        assertFalse(Schedule.merge(p, plan().put("owner", "2")).getJSONObject("marks").has("2099-01-01"));
    }
    @Test public void keepsWallClockTimeThroughDst() throws Exception {
        JSONObject p = plan();
        p.getJSONArray("rules").getJSONObject(0).put("weekdays", new JSONArray("[0,1,2,3,4,5,6]"));
        ZonedDateTime after = LocalDateTime.parse("2026-10-24T09:00").atZone(ZoneId.of("Europe/Berlin"));
        ZonedDateTime next = Schedule.next(p, after);
        assertEquals(8, next.getHour());
        assertEquals(ZoneOffset.ofHours(1), next.getOffset());
    }
    @Test public void skipsSeveralMarkedWeeklyOccurrencesWithoutStoppingTheSchedule() throws Exception {
        JSONObject p = plan();
        p.getJSONArray("rules").getJSONObject(0).put("weekdays", new JSONArray("[1]"));
        p.getJSONObject("marks").put("2026-10-19", new JSONArray().put("med:1:am"));
        p.getJSONObject("marks").put("2026-10-26", new JSONArray().put("med:1:am"));
        assertEquals(date("2026-11-02T08:00"), Schedule.next(p, date("2026-10-15T12:00")));
    }
    @Test public void deliversRulesShiftedOutOfTheSpringDstGap() throws Exception {
        JSONObject p = plan();
        p.getJSONArray("rules").getJSONObject(0).put("startDate", "2026-03-29").put("time", "02:30")
            .put("weekdays", new JSONArray("[0,1,2,3,4,5,6]"));
        ZonedDateTime after = LocalDateTime.parse("2026-03-29T00:00").atZone(ZoneId.of("Europe/Berlin"));
        ZonedDateTime next = Schedule.next(p, after);
        assertEquals(3, next.getHour());
        assertEquals(30, next.getMinute());
        assertEquals(1, Schedule.at(p, next).size());
        assertTrue(Schedule.at(p, next.plusMinutes(1)).isEmpty());
    }
}
