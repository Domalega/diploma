package com.domalega.daymark;

import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;

final class UpdateHttp {
    static HttpURLConnection open(String address) throws IOException {
        for (int redirects = 0; redirects < 6; redirects++) {
            URL url = new URL(address);
            String host = url.getHost();
            if (!"https".equals(url.getProtocol()) || url.getUserInfo() != null || (url.getPort() != -1 && url.getPort() != 443)
                || !(host.equals("github.com") || host.equals("api.github.com") || host.endsWith(".githubusercontent.com")))
                throw new IOException("Untrusted update address");
            HttpURLConnection connection = (HttpURLConnection) url.openConnection();
            connection.setInstanceFollowRedirects(false); connection.setConnectTimeout(15000); connection.setReadTimeout(30000);
            connection.setRequestProperty("User-Agent", "Daymark-Android/" + BuildConfig.VERSION_NAME);
            connection.setRequestProperty("Accept", host.equals("api.github.com") ? "application/vnd.github+json" : "application/octet-stream");
            int status = connection.getResponseCode();
            if (status >= 300 && status <= 399) {
                String next = connection.getHeaderField("Location"); connection.disconnect();
                if (next == null) throw new IOException("Missing update redirect");
                address = new URL(url, next).toString(); continue;
            }
            if (status != 200) { connection.disconnect(); throw new IOException("Update server returned " + status); }
            return connection;
        }
        throw new IOException("Too many update redirects");
    }
    static String json(String address) throws IOException {
        HttpURLConnection connection = open(address);
        try (InputStream input = connection.getInputStream(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192]; int length;
            while ((length = input.read(buffer)) != -1) {
                if (output.size() + length > 1024 * 1024) throw new IOException("Update metadata is too large");
                output.write(buffer, 0, length);
            }
            return output.toString(StandardCharsets.UTF_8.name());
        } finally { connection.disconnect(); }
    }
}
