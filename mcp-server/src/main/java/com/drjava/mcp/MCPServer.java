package com.drjava.mcp;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;

import io.github.cdimascio.dotenv.Dotenv;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.InetSocketAddress;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.stream.Collectors;

/**
 * MCP Server that bridges DrJava to the Google Gemini API.
 */
public class MCPServer {
    private static final int PORT = 8080;
    private static final String GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:streamGenerateContent";
    private final String apiKey;
    private final Gson gson = new Gson();

    public MCPServer() {
        Dotenv dotenv = Dotenv.configure().directory("./mcp-server").ignoreIfMissing().load();
        apiKey = dotenv.get("GEMINI_API_KEY");
        if (apiKey == null || apiKey.trim().isEmpty()) {
            System.err.println("FATAL: GEMINI_API_KEY not found in mcp-server/.env file or as an environment variable.");
            System.err.println("Please create a .env file in the 'mcp-server' directory with your API key.");
            System.exit(1);
        }
    }

    public static void main(String[] args) throws IOException {
        new MCPServer().start();
    }

    public void start() throws IOException {
        HttpServer server = HttpServer.create(new InetSocketAddress(PORT), 0);
        server.createContext("/chat/stream", new StreamChatHandler());
        server.createContext("/health", new HealthHandler());
        server.setExecutor(null);
        server.start();
        System.out.println("MCP Server (Gemini Edition) started on http://localhost:" + PORT);
    }

    private class StreamChatHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            exchange.getResponseHeaders().add("Access-Control-Allow-Origin", "*");
            exchange.getResponseHeaders().add("Access-Control-Allow-Methods", "POST, OPTIONS");
            exchange.getResponseHeaders().add("Access-Control-Allow-Headers", "Content-Type");
            exchange.getResponseHeaders().add("Content-Type", "text/event-stream; charset=UTF-8");
            
            if ("OPTIONS".equals(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                return;
            }

            if (!"POST".equals(exchange.getRequestMethod())) {
                sendError(exchange, 405, "Method Not Allowed");
                return;
            }
            
            String requestBody = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
            JsonObject requestJson = gson.fromJson(requestBody, JsonObject.class);
            JsonArray messages = requestJson.getAsJsonArray("messages");
            
            String geminiPayload = buildGeminiPayload(messages);

            HttpURLConnection connection = (HttpURLConnection) new URL(GEMINI_API_URL + "?key=" + apiKey).openConnection();
            connection.setRequestMethod("POST");
            connection.setRequestProperty("Content-Type", "application/json");
            connection.setDoOutput(true);

            try (OutputStream os = connection.getOutputStream()) {
                os.write(geminiPayload.getBytes(StandardCharsets.UTF_8));
            }

            exchange.sendResponseHeaders(200, 0);

            try (BufferedReader reader = new BufferedReader(new InputStreamReader(connection.getInputStream(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    if (line.trim().startsWith("\"text\":")) {
                        String text = line.substring(line.indexOf(":") + 1).trim();
                        text = text.substring(1, text.length() - 1); // Remove quotes
                        
                        JsonObject sseData = new JsonObject();
                        sseData.addProperty("chunk", text.replace("\\n", "\n").replace("\\\"", "\""));
                        sseData.addProperty("done", false);
                        
                        String sseEvent = "data: " + gson.toJson(sseData) + "\n\n";
                        exchange.getResponseBody().write(sseEvent.getBytes(StandardCharsets.UTF_8));
                        exchange.getResponseBody().flush();
                    }
                }
            } finally {
                // Send completion event
                JsonObject finalSseData = new JsonObject();
                finalSseData.addProperty("chunk", "");
                finalSseData.addProperty("done", true);
                String finalSseEvent = "data: " + gson.toJson(finalSseData) + "\n\n";
                exchange.getResponseBody().write(finalSseEvent.getBytes(StandardCharsets.UTF_8));
                exchange.getResponseBody().flush();
                exchange.close();
            }
        }
    }

    private class HealthHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            sendJsonResponse(exchange, 200, new JsonObject());
        }
    }

    private void sendJsonResponse(HttpExchange exchange, int statusCode, JsonObject response) throws IOException {
        response.addProperty("status", "healthy");
        response.addProperty("model", "gemini-1.5-pro");
        response.addProperty("timestamp", System.currentTimeMillis());
        
        String responseString = gson.toJson(response);
        byte[] responseBytes = responseString.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json; charset=UTF-8");
        exchange.sendResponseHeaders(statusCode, responseBytes.length);
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(responseBytes);
        }
    }

    private void sendError(HttpExchange exchange, int statusCode, String message) throws IOException {
        JsonObject error = new JsonObject();
        error.addProperty("error", message);
        sendJsonResponse(exchange, statusCode, error);
    }
    
    private String buildGeminiPayload(JsonArray messages) {
        JsonObject payload = new JsonObject();
        JsonArray contents = new JsonArray();
        
        messages.forEach(msgElement -> {
            JsonObject msg = msgElement.getAsJsonObject();
            String role = msg.get("role").getAsString().equals("user") ? "user" : "model";
            String text = msg.get("content").getAsString();
            
            JsonObject content = new JsonObject();
            JsonObject part = new JsonObject();
            part.addProperty("text", text);
            content.add("parts", new JsonArray());
            content.getAsJsonArray("parts").add(part);
            content.addProperty("role", role);
            contents.add(content);
        });
        
        payload.add("contents", contents);

        // Add generation config and safety settings
        JsonObject generationConfig = new JsonObject();
        generationConfig.addProperty("temperature", 0.4);
        generationConfig.addProperty("maxOutputTokens", 2048);
        payload.add("generationConfig", generationConfig);

        JsonArray safetySettings = new JsonArray();
        JsonObject safetySetting = new JsonObject();
        safetySetting.addProperty("category", "HARM_CATEGORY_DANGEROUS_CONTENT");
        safetySetting.addProperty("threshold", "BLOCK_ONLY_HIGH");
        safetySettings.add(safetySetting);
        payload.add("safetySettings", safetySettings);
        
        return gson.toJson(payload);
    }
} 