package com.drjava.mcp;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
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
 * Minimal MCP Server that bridges DrJava to Ollama with conversation history support
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
                System.out.println("Received request body: " + requestBody);
                
                if (requestBody == null || requestBody.trim().isEmpty()) {
                    throw new IllegalArgumentException("Request body is empty");
                }
                
                JsonObject request = gson.fromJson(requestBody, JsonObject.class);
                
                if (request == null) {
                    throw new IllegalArgumentException("Invalid JSON format");
                }
                
                // Check if we have messages array (new format) or single message (legacy format)
                String conversationContext;
                if (request.has("messages") && !request.get("messages").isJsonNull()) {
                    JsonArray messages = request.getAsJsonArray("messages");
                    conversationContext = buildConversationContext(messages);
                    System.out.println("Using conversation context from messages array");
                } else if (request.has("message") && !request.get("message").isJsonNull()) {
                    // Legacy single message format
                    String message = request.get("message").getAsString();
                    conversationContext = "You are a helpful Java programming tutor. Answer this question concisely: " + message;
                    System.out.println("Using legacy single message format");
                } else {
                    throw new IllegalArgumentException("Request must contain either 'messages' array or 'message' field");
                }
                
                System.out.println("Received conversation context: " + conversationContext);
                
                // Call Ollama
                String aiResponse = callOllama(conversationContext);
                
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
                System.out.println("Received request body: " + requestBody);
                
                if (requestBody == null || requestBody.trim().isEmpty()) {
                    throw new IllegalArgumentException("Request body is empty");
                }
                
                JsonObject request = gson.fromJson(requestBody, JsonObject.class);
                
                if (request == null) {
                    throw new IllegalArgumentException("Invalid JSON format");
                }
                
                // Check if we have messages array (new format) or single message (legacy format)
                String conversationContext;
                if (request.has("messages") && !request.get("messages").isJsonNull()) {
                    JsonArray messages = request.getAsJsonArray("messages");
                    conversationContext = buildConversationContext(messages);
                    System.out.println("Using conversation context from messages array");
                } else if (request.has("message") && !request.get("message").isJsonNull()) {
                    // Legacy single message format
                    String message = request.get("message").getAsString();
                    conversationContext = "You are a helpful Java programming tutor. Answer this question concisely: " + message;
                    System.out.println("Using legacy single message format");
                } else {
                    throw new IllegalArgumentException("Request must contain either 'messages' array or 'message' field");
                }
                
                System.out.println("Received streaming conversation context: " + conversationContext);
                
                // Start streaming response
                exchange.sendResponseHeaders(200, 0);
                OutputStream os = exchange.getResponseBody();
                
                // Stream AI response
                streamOllamaResponse(conversationContext, os);
                
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
    
    private String callOllama(String conversationContext) throws IOException, ParseException {
        // Create Ollama request
        JsonObject ollamaRequest = new JsonObject();
        ollamaRequest.addProperty("model", MODEL);
        ollamaRequest.addProperty("prompt", conversationContext);
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
    
    private void streamOllamaResponse(String conversationContext, OutputStream outputStream) throws IOException {
        // Create Ollama streaming request
        JsonObject ollamaRequest = new JsonObject();
        ollamaRequest.addProperty("model", MODEL);
        ollamaRequest.addProperty("prompt", conversationContext);
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
    
    /**
     * Builds conversation context from messages array for Ollama with smart context management
     */
    private String buildConversationContext(JsonArray messages) {
        StringBuilder context = new StringBuilder();
        context.append("You are a helpful Java programming tutor.\n\n");
        
        // Extract the current document context from the latest message
        String currentDocumentContext = null;
        if (messages.size() > 0) {
            JsonObject latestMessage = messages.get(messages.size() - 1).getAsJsonObject();
            String latestContent = latestMessage.get("content").getAsString();
            
            // Extract current document context (appears after "Current open file:")
            int docContextStart = latestContent.indexOf("Current open file:");
            if (docContextStart != -1) {
                currentDocumentContext = latestContent.substring(docContextStart);
                // Remove document context from the user's actual question
                String userQuestion = latestContent.substring(0, docContextStart).trim();
                // Update the latest message content to just the user's question
                latestMessage.addProperty("content", userQuestion);
            }
        }
        
        // Add conversation history (without document contexts)
        context.append("Conversation history:\n");
        for (JsonElement messageElement : messages) {
            JsonObject message = messageElement.getAsJsonObject();
            String role = message.get("role").getAsString();
            String content = message.get("content").getAsString();
            
            // Skip empty messages or messages that are just document context
            if (content.trim().isEmpty() || content.startsWith("Current open file:")) {
                continue;
            }
            
            // Clean up content - remove any embedded document contexts from historical messages
            String cleanContent = _removeDocumentContext(content);
            if (cleanContent.trim().isEmpty()) {
                continue;
            }
            
            if ("user".equals(role)) {
                context.append("Human: ").append(cleanContent).append("\n");
            } else if ("assistant".equals(role)) {
                context.append("Assistant: ").append(cleanContent).append("\n");
            }
        }
        
        // Add current document context at the end (only the latest one)
        if (currentDocumentContext != null) {
            context.append("\n").append(currentDocumentContext).append("\n");
        }
        
        context.append("\nPlease respond as the Assistant. Focus on the current question and the current document context. Be concise and helpful.");
        return context.toString();
    }
    
    /**
     * Removes document context from message content to prevent accumulation
     */
    private String _removeDocumentContext(String content) {
        // Remove "Current open file:" sections
        int docContextStart = content.indexOf("Current open file:");
        if (docContextStart != -1) {
            return content.substring(0, docContextStart).trim();
        }
        
        // Remove "Regarding this code:" sections that might contain old context
        int codeContextStart = content.indexOf("Regarding this code:");
        if (codeContextStart != -1) {
            // Look for the actual question after the code context
            String afterCode = content.substring(codeContextStart);
            int questionStart = afterCode.indexOf('\n');
            if (questionStart != -1) {
                String potentialQuestion = afterCode.substring(questionStart + 1).trim();
                if (!potentialQuestion.isEmpty() && !potentialQuestion.startsWith("Current open file:")) {
                    return potentialQuestion;
                }
            }
            return content.substring(0, codeContextStart).trim();
        }
        
        return content;
    }
} 