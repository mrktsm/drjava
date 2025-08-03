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
import com.google.gson.GsonBuilder;
import com.google.gson.stream.JsonReader;
import java.nio.file.*;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.*;
import java.util.regex.Pattern;

/**
 * MCP Server that bridges DrJava to the Google Gemini API with file system tool support.
 */
public class MCPServer {
    private static final int PORT = 8080;
    private static final String GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:streamGenerateContent";
    private final String apiKey;
    private final Gson gson = new GsonBuilder().disableHtmlEscaping().create();
    private final String workspaceRoot;

    public MCPServer() {
        Dotenv dotenv = Dotenv.configure().directory(".").ignoreIfMissing().load();
        apiKey = dotenv.get("GEMINI_API_KEY");
        if (apiKey == null || apiKey.trim().isEmpty()) {
            System.err.println("FATAL: GEMINI_API_KEY not found in .env file or as an environment variable.");
            System.err.println("Please create a .env file in the 'mcp-server' directory with your API key.");
            System.exit(1);
        }
        
        // Set workspace root to parent directory (drjava project root)
        workspaceRoot = Paths.get("").toAbsolutePath().getParent().toString();
        System.out.println("Workspace root: " + workspaceRoot);
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
        System.out.println("MCP Server (Gemini Edition) with file system tools started on http://localhost:" + PORT);
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
            
            // Add request size validation
            if (requestBody.length() > 1000000) { // 1MB limit
                exchange.sendResponseHeaders(200, 0);
                OutputStream responseBody = exchange.getResponseBody();
                sendSseEvent(responseBody, "error", "Request too large. Please reduce the amount of context.", true);
                exchange.close();
                return;
            }
            
            JsonObject requestJson;
            try {
                requestJson = gson.fromJson(requestBody, JsonObject.class);
            } catch (Exception e) {
                System.err.println("Error parsing request JSON: " + e.getMessage());
                exchange.sendResponseHeaders(200, 0);
                OutputStream responseBody = exchange.getResponseBody();
                sendSseEvent(responseBody, "error", "Invalid JSON in request: " + e.getMessage(), true);
                exchange.close();
                return;
            }
            
            JsonArray messages = requestJson.getAsJsonArray("messages");
            if (messages == null) {
                exchange.sendResponseHeaders(200, 0);
                OutputStream responseBody = exchange.getResponseBody();
                sendSseEvent(responseBody, "error", "No messages array in request", true);
                exchange.close();
                return;
            }
            
            // Extract context information
            String contextWorkingDirectory = workspaceRoot; // Default to server's workspace root
            String contextCurrentFile = null;
            
            if (requestJson.has("context")) {
                JsonObject context = requestJson.getAsJsonObject("context");
                if (context.has("workingDirectory")) {
                    String clientWorkingDir = context.get("workingDirectory").getAsString();
                    // Use client's working directory if it's valid and accessible
                    Path clientPath = Paths.get(clientWorkingDir);
                    if (Files.exists(clientPath) && Files.isDirectory(clientPath)) {
                        contextWorkingDirectory = clientWorkingDir;
                        System.out.println("Using client working directory: " + contextWorkingDirectory);
                    }
                }
                if (context.has("currentFile")) {
                    contextCurrentFile = context.get("currentFile").getAsString();
                    System.out.println("Current file: " + contextCurrentFile);
                    
                    // If we have a current file, use its directory as working directory
                    if (contextCurrentFile != null) {
                        try {
                            Path filePath = Paths.get(contextCurrentFile);
                            if (Files.exists(filePath)) {
                                Path fileDir = filePath.getParent();
                                if (fileDir != null && Files.isDirectory(fileDir)) {
                                    contextWorkingDirectory = fileDir.toString();
                                    System.out.println("Using file's directory as working directory: " + contextWorkingDirectory);
                                }
                            }
                        } catch (Exception e) {
                            System.err.println("Error processing current file path: " + e.getMessage());
                        }
                    }
                }
            }

            exchange.sendResponseHeaders(200, 0);
            OutputStream responseBody = exchange.getResponseBody();

            try {
                processConversationWithTools(messages, responseBody, contextWorkingDirectory);
            } catch (Exception e) {
                e.printStackTrace();
                sendSseEvent(responseBody, "error", "Error processing request: " + e.getMessage(), true);
            } finally {
                sendSseEvent(responseBody, "text", "", true);
                exchange.close();
            }
        }
    }
    
    private void processConversationWithTools(JsonArray messages, OutputStream responseBody, String contextWorkingDirectory) throws IOException {
        List<JsonObject> conversationHistory = new ArrayList<>();
        
        // Convert messages to Gemini format
        for (JsonElement msgElement : messages) {
            JsonObject msg = msgElement.getAsJsonObject();
            String role = msg.get("role").getAsString().equals("user") ? "user" : "model";
            String text = msg.get("content").getAsString();
            
            JsonObject content = new JsonObject();
            JsonObject part = new JsonObject();
            part.addProperty("text", text);
            content.add("parts", new JsonArray());
            content.getAsJsonArray("parts").add(part);
            content.addProperty("role", role);
            conversationHistory.add(content);
        }
        
        // Call Gemini API with tools and stream the response
        String geminiPayload = buildGeminiPayloadWithTools(conversationHistory);
        callGeminiApiStreaming(geminiPayload, responseBody, contextWorkingDirectory);
    }
    
    private void sendSseEvent(OutputStream responseBody, String type, String content, boolean done) throws IOException {
        JsonObject sseData = new JsonObject();
        sseData.addProperty("type", type);
        sseData.addProperty("chunk", content);
        sseData.addProperty("done", done);
        
        String sseEvent = "data: " + gson.toJson(sseData) + "\n\n";
        responseBody.write(sseEvent.getBytes(StandardCharsets.UTF_8));
        responseBody.flush();
    }
    
    private void sendSseToolUse(OutputStream responseBody, String toolName, JsonObject args) throws IOException {
        JsonObject sseData = new JsonObject();
        sseData.addProperty("type", "tool_use");
        sseData.addProperty("tool", toolName);
        sseData.add("args", args);
        sseData.addProperty("done", false);
        
        String sseEvent = "data: " + gson.toJson(sseData) + "\n\n";
        responseBody.write(sseEvent.getBytes(StandardCharsets.UTF_8));
        responseBody.flush();
    }
    
    private void sendSseToolResult(OutputStream responseBody, String result) throws IOException {
        JsonObject sseData = new JsonObject();
        sseData.addProperty("type", "tool_result");
        sseData.addProperty("result", result.length() > 200 ? result.substring(0, 200) + "..." : result);
        sseData.addProperty("done", false);
        
        String sseEvent = "data: " + gson.toJson(sseData) + "\n\n";
        responseBody.write(sseEvent.getBytes(StandardCharsets.UTF_8));
        responseBody.flush();
    }
    
    private void callGeminiApiStreaming(String payload, OutputStream responseBody, String contextWorkingDirectory) throws IOException {
        HttpURLConnection connection = (HttpURLConnection) new URL(GEMINI_API_URL + "?key=" + apiKey).openConnection();
        connection.setRequestMethod("POST");
        connection.setRequestProperty("Content-Type", "application/json");
        connection.setDoOutput(true);

        try (OutputStream os = connection.getOutputStream()) {
            os.write(payload.getBytes(StandardCharsets.UTF_8));
        }

        try (JsonReader reader = new JsonReader(new InputStreamReader(connection.getInputStream(), StandardCharsets.UTF_8))) {
            reader.setLenient(true);
            reader.beginArray();
            
            StringBuilder fullTextResponse = new StringBuilder();
            boolean hasToolCalls = false;
            
            while (reader.hasNext()) {
                JsonObject responseJson = gson.fromJson(reader, JsonObject.class);
                
                JsonElement candidatesEl = responseJson.get("candidates");
                if (candidatesEl == null || !candidatesEl.isJsonArray()) continue;
                
                JsonArray candidates = candidatesEl.getAsJsonArray();
                if (candidates.isEmpty()) continue;
                
                JsonObject candidate = candidates.get(0).getAsJsonObject();
                JsonObject content = candidate.getAsJsonObject("content");
                if (content == null) continue;

                JsonArray parts = content.getAsJsonArray("parts");
                if (parts == null) continue;
                
                for (JsonElement partEl : parts) {
                    JsonObject part = partEl.getAsJsonObject();
                    
                    if (part.has("functionCall")) {
                        hasToolCalls = true;
                        JsonObject functionCall = part.getAsJsonObject("functionCall");
                        String functionName = functionCall.get("name").getAsString();
                        JsonObject args = functionCall.getAsJsonObject("args");
                        
                        // Send tool usage event
                        sendSseToolUse(responseBody, functionName, args);
                        
                        // Execute the tool
                        String toolResult = executeToolCall(functionName, args, 
                                                          contextWorkingDirectory); // Use working directory
                        
                        // Send tool result event  
                        sendSseToolResult(responseBody, toolResult);
                        
                    } else if (part.has("text")) {
                        String text = part.get("text").getAsString();
                        fullTextResponse.append(text);
                        
                        // Send text chunk immediately for real streaming effect
                        sendSseEvent(responseBody, "text", text, false);
                    }
                }
            }
        } catch (IOException e) {
            System.err.println("IOException during Gemini stream processing: " + e.getMessage());
            sendSseEvent(responseBody, "error", "Streaming error: " + e.getMessage(), true);
        }
    }
    
    private String executeToolCall(String functionName, JsonObject args, String contextWorkingDirectory) {
        try {
            switch (functionName) {
                case "read_file":
                    return readFile(args.get("path").getAsString(), contextWorkingDirectory);
                case "list_directory":
                    return listDirectory(args.get("path").getAsString(), contextWorkingDirectory);
                case "search_files":
                    return searchFiles(args.get("pattern").getAsString(), 
                                     args.has("directory") ? args.get("directory").getAsString() : "",
                                     contextWorkingDirectory);
                default:
                    return "Unknown function: " + functionName;
            }
        } catch (Exception e) {
            return "Error executing " + functionName + ": " + e.getMessage();
        }
    }
    
    private String readFile(String relativePath, String contextWorkingDirectory) throws IOException {
        Path filePath = Paths.get(contextWorkingDirectory, relativePath).normalize();
        
        // Security check - ensure path is within workspace
        if (!filePath.startsWith(contextWorkingDirectory)) {
            throw new SecurityException("Access denied: path outside workspace");
        }
        
        if (!Files.exists(filePath)) {
            throw new IOException("File not found: " + relativePath);
        }
        
        if (Files.isDirectory(filePath)) {
            throw new IOException("Path is a directory, not a file: " + relativePath);
        }
        
        // Check file size to prevent reading huge files
        long size = Files.size(filePath);
        if (size > 50000) { // 50KB limit
            return String.format("File too large (%d bytes). Consider using search_files instead.", size);
        }
        
        String content = Files.readString(filePath);
        return String.format("File: %s (%d lines)\n```\n%s\n```", relativePath, 
                            content.split("\n").length, content);
    }
    
    private String listDirectory(String relativePath, String contextWorkingDirectory) throws IOException {
        Path dirPath = relativePath.isEmpty() ? Paths.get(contextWorkingDirectory) : 
                       Paths.get(contextWorkingDirectory, relativePath).normalize();
        
        // Security check
        if (!dirPath.startsWith(contextWorkingDirectory)) {
            throw new SecurityException("Access denied: path outside workspace");
        }
        
        if (!Files.exists(dirPath)) {
            throw new IOException("Directory not found: " + relativePath);
        }
        
        if (!Files.isDirectory(dirPath)) {
            throw new IOException("Path is not a directory: " + relativePath);
        }
        
        StringBuilder result = new StringBuilder();
        result.append("Directory: ").append(relativePath.isEmpty() ? "/" : relativePath).append("\n\n");
        
        try (DirectoryStream<Path> stream = Files.newDirectoryStream(dirPath)) {
            List<String> entries = new ArrayList<>();
            
            for (Path entry : stream) {
                String name = entry.getFileName().toString();
                String type = Files.isDirectory(entry) ? "📁 " : "📄 ";
                entries.add(type + name);
            }
            
            entries.sort(String::compareToIgnoreCase);
            for (String entry : entries) {
                result.append(entry).append("\n");
            }
        }
        
        return result.toString();
    }
    
    private String searchFiles(String pattern, String directory, String contextWorkingDirectory) throws IOException {
        Path searchRoot = directory.isEmpty() ? Paths.get(contextWorkingDirectory) : 
                         Paths.get(contextWorkingDirectory, directory).normalize();
        
        // Security check
        if (!searchRoot.startsWith(contextWorkingDirectory)) {
            throw new SecurityException("Access denied: path outside workspace");
        }
        
        if (!Files.exists(searchRoot)) {
            throw new IOException("Search directory not found: " + directory);
        }
        
        Pattern filePattern = Pattern.compile(".*" + Pattern.quote(pattern) + ".*", Pattern.CASE_INSENSITIVE);
        List<String> matches = new ArrayList<>();
        
        Files.walkFileTree(searchRoot, new SimpleFileVisitor<Path>() {
            @Override
            public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) {
                String relativePath = Paths.get(contextWorkingDirectory).relativize(file).toString();
                if (filePattern.matcher(file.getFileName().toString()).matches()) {
                    matches.add(relativePath);
                }
                return matches.size() < 20 ? FileVisitResult.CONTINUE : FileVisitResult.TERMINATE;
            }
            
            @Override
            public FileVisitResult preVisitDirectory(Path dir, BasicFileAttributes attrs) {
                // Skip hidden directories and common build/dependency directories
                String name = dir.getFileName().toString();
                if (name.startsWith(".") || name.equals("node_modules") || 
                    name.equals("target") || name.equals("build") || name.equals("out")) {
                    return FileVisitResult.SKIP_SUBTREE;
                }
                return FileVisitResult.CONTINUE;
            }
        });
        
        StringBuilder result = new StringBuilder();
        result.append("Found ").append(matches.size()).append(" files matching '").append(pattern).append("':\n\n");
        
        for (String match : matches) {
            result.append("📄 ").append(match).append("\n");
        }
        
        return result.toString();
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
    
    private String buildGeminiPayloadWithTools(List<JsonObject> conversationHistory) {
        JsonObject payload = new JsonObject();
        
        JsonArray contents = new JsonArray();
        for (JsonObject content : conversationHistory) {
            contents.add(content);
        }
        payload.add("contents", contents);

        // Add tool definitions
        JsonArray tools = new JsonArray();
        JsonObject toolsWrapper = new JsonObject();
        JsonArray functionDeclarations = new JsonArray();
        
        // read_file tool
        JsonObject readFileFunction = new JsonObject();
        readFileFunction.addProperty("name", "read_file");
        readFileFunction.addProperty("description", "Read the contents of a file");
        JsonObject readFileParams = new JsonObject();
        readFileParams.addProperty("type", "object");
        JsonObject readFileProperties = new JsonObject();
        JsonObject pathProperty = new JsonObject();
        pathProperty.addProperty("type", "string");
        pathProperty.addProperty("description", "Relative path to the file from project root");
        readFileProperties.add("path", pathProperty);
        readFileParams.add("properties", readFileProperties);
        JsonArray readFileRequired = new JsonArray();
        readFileRequired.add("path");
        readFileParams.add("required", readFileRequired);
        readFileFunction.add("parameters", readFileParams);
        functionDeclarations.add(readFileFunction);
        
        // list_directory tool
        JsonObject listDirFunction = new JsonObject();
        listDirFunction.addProperty("name", "list_directory");
        listDirFunction.addProperty("description", "List files and directories in a given directory");
        JsonObject listDirParams = new JsonObject();
        listDirParams.addProperty("type", "object");
        JsonObject listDirProperties = new JsonObject();
        JsonObject dirPathProperty = new JsonObject();
        dirPathProperty.addProperty("type", "string");
        dirPathProperty.addProperty("description", "Relative path to directory (empty string for root)");
        listDirProperties.add("path", dirPathProperty);
        listDirParams.add("properties", listDirProperties);
        JsonArray listDirRequired = new JsonArray();
        listDirRequired.add("path");
        listDirParams.add("required", listDirRequired);
        listDirFunction.add("parameters", listDirParams);
        functionDeclarations.add(listDirFunction);
        
        // search_files tool
        JsonObject searchFunction = new JsonObject();
        searchFunction.addProperty("name", "search_files");
        searchFunction.addProperty("description", "Search for files by name pattern");
        JsonObject searchParams = new JsonObject();
        searchParams.addProperty("type", "object");
        JsonObject searchProperties = new JsonObject();
        JsonObject patternProperty = new JsonObject();
        patternProperty.addProperty("type", "string");
        patternProperty.addProperty("description", "File name pattern to search for");
        searchProperties.add("pattern", patternProperty);
        JsonObject searchDirProperty = new JsonObject();
        searchDirProperty.addProperty("type", "string");
        searchDirProperty.addProperty("description", "Directory to search in (optional, defaults to root)");
        searchProperties.add("directory", searchDirProperty);
        searchParams.add("properties", searchProperties);
        JsonArray searchRequired = new JsonArray();
        searchRequired.add("pattern");
        searchParams.add("required", searchRequired);
        searchFunction.add("parameters", searchParams);
        functionDeclarations.add(searchFunction);
        
        toolsWrapper.add("functionDeclarations", functionDeclarations);
        tools.add(toolsWrapper);
        payload.add("tools", tools);

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