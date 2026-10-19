package com.domalega.daymark;

import org.json.*;
import java.net.URL;
import javax.net.ssl.HttpsURLConnection;
import java.io.*;
import java.nio.charset.StandardCharsets;

final class OfflineHttp {
    static final class Failure extends IOException {
        final int status; final JSONObject response;
        Failure(int status, String message) { super(message); this.status = status; this.response = null; }
        Failure(int status, JSONObject response) { super(response.optString("message", "Synchronization failed. Try again.")); this.status = status; this.response = response; }
    }
    static boolean supportedPath(String path) {
        boolean user = path.startsWith("/user/") && !path.contains("?") && !path.contains("#") && !path.contains("..");
        boolean sync = path.equals("/sync") || path.equals("/sync?history=none");
        boolean history = path.matches("/kanban/tasks/[0-9a-fA-F-]{36}/history\\?limit=(?:[1-9]|[1-9][0-9]|100)(?:&before=[1-9][0-9]*)?");
        return user || sync || history;
    }
    static JSONObject call(String path, String method, JSONObject body, String token) throws Exception {
        if (!supportedPath(path)) throw new Failure(400, "Unsupported network request");
        HttpsURLConnection connection = (HttpsURLConnection) new URL(BuildConfig.API_URL + path).openConnection();
        connection.setInstanceFollowRedirects(false);
        connection.setConnectTimeout(15000); connection.setReadTimeout(path.startsWith("/kanban/") ? 15000 : 60000); connection.setRequestMethod(method);
        connection.setRequestProperty("Accept", "application/json");
        if (token != null && !token.isEmpty()) connection.setRequestProperty("Authorization", "Bearer " + token);
        try {
            if (body != null) {
                connection.setDoOutput(true); connection.setRequestProperty("Content-Type", "application/json");
                try (OutputStream out = connection.getOutputStream()) { out.write(body.toString().getBytes(StandardCharsets.UTF_8)); }
            }
            int code = connection.getResponseCode();
            InputStream stream = code >= 200 && code < 300 ? connection.getInputStream() : connection.getErrorStream();
            if (stream == null) throw new Failure(code, "Synchronization failed. Try again.");
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            try (InputStream in = stream) {
                byte[] buffer = new byte[8192]; int count;
                while ((count = in.read(buffer)) != -1) { bytes.write(buffer, 0, count); if (bytes.size() > 8_000_000) throw new IOException("Server data is too large for this app version."); }
            }
            JSONObject response;
            try { response = new JSONObject(bytes.toString("UTF-8")); } catch (JSONException e) { throw new Failure(code, "Invalid response from the server"); }
            if (code < 200 || code >= 300) throw new Failure(code, response);
            return response;
        } finally { connection.disconnect(); }
    }
}
