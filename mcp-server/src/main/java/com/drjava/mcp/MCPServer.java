package com.drjava.mcp;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;
import org.apache.hc.client5.http.classic.methods.HttpPost;
import org.apache.hc.client5.http.impl.classic.CloseableHttpClient;
import org.apache.hc.client5.http.impl.classic.CloseableHttpResponse;
import org.apache.hc.client5.http.impl.classic.HttpClients;
import org.apache.hc.core5.http.ContentType;
import org.apache.hc.core5.http.ParseException;
import org.apache.hc.core5.http.io.entity.EntityUtils;
import org.apache.hc.core5.http.io.entity.StringEntity;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;

/**
 * Minimal MCP Server that bridges DrJava to Ollama
 */
public class MCPServer {
    private static final int PORT = 8080;
    private static final String OLLAMA_URL = "http://localhost:11434/api/generate";
    private static final String MODEL = "llama3.2:1b";
    
    private final Gson gson = new Gson();
    private final CloseableHttpClient httpClient = HttpClients.createDefault();
    
    public static void main(String[] args) throws IOException {
        new MCPServer().start();
    }
    
    public void start() throws IOException {
        HttpServer server = HttpServer.create(new InetSocketAddress(PORT), 0);
        
        // Add CORS headers for all responses
        server.createContext("/chat", new ChatHandler());
        server.createContext("/chat/stream", new StreamChatHandler());
        server.createContext("/health", new HealthHandler());
        
        server.setExecutor(null); // Use default executor
        server.start();
        
        System.out.println("MCP Server started on http://localhost:" + PORT);
        System.out.println("Endpoints:");
        System.out.println("  POST /chat - Send chat message");
        System.out.println("  POST /chat/stream - Stream chat response");
        System.out.println("  GET /health - Health check");
    }
    
    private class ChatHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            // Add CORS headers
            exchange.getResponseHeaders().add("Access-Control-Allow-Origin", "*");
            exchange.getResponseHeaders().add("Access-Control-Allow-Methods", "POST, OPTIONS");
            exchange.getResponseHeaders().add("Access-Control-Allow-Headers", "Content-Type");
            
            if ("OPTIONS".equals(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(200, 0);
                exchange.close();
                return;
            }
            
            if (!"POST".equals(exchange.getRequestMethod())) {
                sendError(exchange, 405, "Method not allowed");
                return;
            }
            
            try {
                // Read request body
                String requestBody = readRequestBody(exchange.getRequestBody());
                JsonObject request = gson.fromJson(requestBody, JsonObject.class);
                
                String message = request.get("message").getAsString();
                System.out.println("Received message: " + message);
                
                // Call Ollama
                String aiResponse = callOllama(message);
                
                // Send response
                JsonObject response = new JsonObject();
                response.addProperty("response", aiResponse);
                response.addProperty("success", true);
                
                sendJsonResponse(exchange, 200, response);
                
            } catch (Exception e) {
                e.printStackTrace();
                sendError(exchange, 500, "Internal server error: " + e.getMessage());
            }
        }
    }
    
    private class StreamChatHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            // Add CORS headers for SSE
            exchange.getResponseHeaders().add("Access-Control-Allow-Origin", "*");
            exchange.getResponseHeaders().add("Access-Control-Allow-Methods", "POST, OPTIONS");
            exchange.getResponseHeaders().add("Access-Control-Allow-Headers", "Content-Type");
            exchange.getResponseHeaders().add("Content-Type", "text/event-stream");
            exchange.getResponseHeaders().add("Cache-Control", "no-cache");
            exchange.getResponseHeaders().add("Connection", "keep-alive");
            
            if ("OPTIONS".equals(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(200, 0);
                exchange.close();
                return;
            }
            
            if (!"POST".equals(exchange.getRequestMethod())) {
                sendError(exchange, 405, "Method not allowed");
                return;
            }
            
            try {
                // Read request body
                String requestBody = readRequestBody(exchange.getRequestBody());
                JsonObject request = gson.fromJson(requestBody, JsonObject.class);
                
                String message = request.get("message").getAsString();
                System.out.println("Received streaming message: " + message);
                
                // Start streaming response
                exchange.sendResponseHeaders(200, 0);
                OutputStream os = exchange.getResponseBody();
                
                // Stream AI response
                streamOllamaResponse(message, os);
                
                os.close();
                
            } catch (Exception e) {
                e.printStackTrace();
                try {
                    if (!exchange.getResponseHeaders().containsKey("Content-Type")) {
                        sendError(exchange, 500, "Internal server error: " + e.getMessage());
                    }
                } catch (Exception ignored) {
                    // Response already started, can't send error
                }
            }
        }
    }
    
    private class HealthHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            JsonObject response = new JsonObject();
            response.addProperty("status", "healthy");
            response.addProperty("timestamp", System.currentTimeMillis());
            
            sendJsonResponse(exchange, 200, response);
        }
    }
    
    private String callOllama(String message) throws IOException, ParseException {
        // Create Ollama request
        JsonObject ollamaRequest = new JsonObject();
        ollamaRequest.addProperty("model", MODEL);
        ollamaRequest.addProperty("prompt", "You are a helpful Java programming tutor. Answer this question concisely: " + message);
        ollamaRequest.addProperty("stream", false);
        
        // Send to Ollama
        HttpPost post = new HttpPost(OLLAMA_URL);
        post.setEntity(new StringEntity(gson.toJson(ollamaRequest), ContentType.APPLICATION_JSON));
        
        try (CloseableHttpResponse response = httpClient.execute(post)) {
            String responseBody = EntityUtils.toString(response.getEntity(), StandardCharsets.UTF_8);
            JsonObject ollamaResponse = gson.fromJson(responseBody, JsonObject.class);
            
            if (ollamaResponse.has("response")) {
                return ollamaResponse.get("response").getAsString();
            } else {
                return "Sorry, I couldn't generate a response.";
            }
        }
    }
    
    private void streamOllamaResponse(String message, OutputStream outputStream) throws IOException {
        // Create Ollama streaming request
        JsonObject ollamaRequest = new JsonObject();
        ollamaRequest.addProperty("model", MODEL);
        ollamaRequest.addProperty("prompt", "You are a helpful Java programming tutor. Answer this question concisely: " + message);
        ollamaRequest.addProperty("stream", true);
        
        // Send to Ollama
        HttpPost post = new HttpPost(OLLAMA_URL);
        post.setEntity(new StringEntity(gson.toJson(ollamaRequest), ContentType.APPLICATION_JSON));
        
        try (CloseableHttpResponse response = httpClient.execute(post)) {
            try (BufferedReader reader = new BufferedReader(
                    new InputStreamReader(response.getEntity().getContent(), StandardCharsets.UTF_8))) {
                
                String line;
                while ((line = reader.readLine()) != null) {
                    if (!line.trim().isEmpty()) {
                        try {
                            JsonObject chunk = gson.fromJson(line, JsonObject.class);
                            
                            if (chunk.has("response")) {
                                String textChunk = chunk.get("response").getAsString();
                                
                                // Send SSE event
                                JsonObject sseData = new JsonObject();
                                sseData.addProperty("chunk", textChunk);
                                sseData.addProperty("done", chunk.has("done") && chunk.get("done").getAsBoolean());
                                
                                String sseEvent = "data: " + gson.toJson(sseData) + "\n\n";
                                outputStream.write(sseEvent.getBytes(StandardCharsets.UTF_8));
                                outputStream.flush();
                                
                                // If this is the last chunk, break
                                if (chunk.has("done") && chunk.get("done").getAsBoolean()) {
                                    break;
                                }
                            }
                        } catch (Exception e) {
                            System.err.println("Error parsing chunk: " + line);
                            e.printStackTrace();
                        }
                    }
                }
                
                // Send completion event
                JsonObject completionData = new JsonObject();
                completionData.addProperty("chunk", "");
                completionData.addProperty("done", true);
                String completionEvent = "data: " + gson.toJson(completionData) + "\n\n";
                outputStream.write(completionEvent.getBytes(StandardCharsets.UTF_8));
                outputStream.flush();
                
            }
        } catch (Exception e) {
            // Send error event
            JsonObject errorData = new JsonObject();
            errorData.addProperty("error", "Error streaming response: " + e.getMessage());
            errorData.addProperty("done", true);
            String errorEvent = "data: " + gson.toJson(errorData) + "\n\n";
            outputStream.write(errorEvent.getBytes(StandardCharsets.UTF_8));
            outputStream.flush();
        }
    }
    
    private String readRequestBody(InputStream inputStream) throws IOException {
        return new String(inputStream.readAllBytes(), StandardCharsets.UTF_8);
    }
    
    private void sendJsonResponse(HttpExchange exchange, int statusCode, JsonObject response) throws IOException {
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        String responseString = gson.toJson(response);
        byte[] responseBytes = responseString.getBytes(StandardCharsets.UTF_8);
        
        exchange.sendResponseHeaders(statusCode, responseBytes.length);
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(responseBytes);
        }
    }
    
    private void sendError(HttpExchange exchange, int statusCode, String message) throws IOException {
        JsonObject error = new JsonObject();
        error.addProperty("error", message);
        error.addProperty("success", false);
        
        sendJsonResponse(exchange, statusCode, error);
    }
} 