package edu.rice.cs.drjava.log;

import java.io.File;
import java.io.FileNotFoundException;
import java.util.Scanner;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class TextReconstructor {
    // Regex for a recoverable text insertion.
    // It captures the position (group 1) and the inserted text (group 2).
    private static final Pattern INSERT_PATTERN = Pattern.compile(".*: Text inserted at position (\\d+): \"(.*)\"$");

    // Regex for a text deletion. Captures position (1) and length (2).
    private static final Pattern DELETE_PATTERN = Pattern.compile(".*: Text deleted at position (\\d+) \\(length: (\\d+)\\)$");

    // Regex for an unrecoverable text insertion (where only length is logged).
    private static final Pattern INSERT_UNRECOVERABLE_PATTERN = Pattern.compile(".*: Text inserted at position (\\d+) \\(length: (\\d+)\\)$");

    public static void main(String[] args) {
        if (args.length == 0) {
            System.err.println("Usage: java edu.rice.cs.drjava.log.TextReconstructor <path_to_log_file>");
            return;
        }

        String logFilePath = args[0];
        File logFile = new File(logFilePath);
        StringBuilder document = new StringBuilder();

        if (!logFile.exists()) {
            System.err.println("Error: Log file not found at " + logFilePath);
            return;
        }

        try (Scanner scanner = new Scanner(logFile, "UTF-8")) {
            int lineNumber = 0;
            while (scanner.hasNextLine()) {
                lineNumber++;
                String line = scanner.nextLine();

                Matcher insertMatcher = INSERT_PATTERN.matcher(line);
                if (insertMatcher.matches()) {
                    String insertedText = insertMatcher.group(2).replace("\n", "\\n"); // Get text and escape newlines
                    applyInsertion(insertMatcher, document, lineNumber, line);

                    System.out.println("--- After log line " + lineNumber + " ---");
                    System.out.println("Action: Inserted \"" + insertedText + "\"");
                    System.out.println("Document state:");
                    System.out.println(document.toString());
                    System.out.println("------------------------------------");
                    continue;
                }

                Matcher deleteMatcher = DELETE_PATTERN.matcher(line);
                if (deleteMatcher.matches()) {
                    String position = deleteMatcher.group(1);
                    String length = deleteMatcher.group(2);
                    applyDeletion(deleteMatcher, document, lineNumber, line);

                    System.out.println("--- After log line " + lineNumber + " ---");
                    System.out.println("Action: Deleted " + length + " character(s) at position " + position);
                    System.out.println("Document state:");
                    System.out.println(document.toString());
                    System.out.println("------------------------------------");
                    continue;
                }
                
                Matcher insertUnrecoverableMatcher = INSERT_UNRECOVERABLE_PATTERN.matcher(line);
                if (insertUnrecoverableMatcher.matches()) {
                    System.err.println("Warning: Unrecoverable insertion on line " + lineNumber + ". Only length was logged.");
                    continue;
                }
                
                if (!line.trim().isEmpty()) {
                    System.err.println("Warning: Unrecognized log format on line " + lineNumber + ": " + line);
                }
            }

            System.out.println("--- RECONSTRUCTED DOCUMENT ---");
            System.out.println(document.toString());

        } catch (FileNotFoundException e) {
            System.err.println("Error: Log file not found at " + logFilePath);
        } catch (Exception e) {
            System.err.println("An unexpected error occurred during reconstruction:");
            e.printStackTrace();
        }
    }
    
    private static void applyInsertion(Matcher matcher, StringBuilder document, int lineNumber, String line) {
        try {
            int position = Integer.parseInt(matcher.group(1));
            String text = matcher.group(2);

            // Pad with spaces if trying to insert past the end. This is a simple way to handle
            // what might otherwise be an invalid position after a large deletion.
            while (position > document.length()) {
                document.append(' ');
            }
            
            document.insert(position, text);
        } catch (NumberFormatException e) {
            System.err.println("Warning: Could not parse position on line " + lineNumber + ": " + line);
        }
    }

    private static void applyDeletion(Matcher matcher, StringBuilder document, int lineNumber, String line) {
        try {
            int position = Integer.parseInt(matcher.group(1));
            int length = Integer.parseInt(matcher.group(2));
            
            int endPosition = position + length;

            // Prevent crashing if the log contains a deletion that goes past the end
            // of our reconstructed document.
            if (endPosition > document.length()) {
                System.err.println("Warning: Deletion on line " + lineNumber + " exceeds document length. Truncating.");
                endPosition = document.length();
            }

            if (position > endPosition) {
                System.err.println("Warning: Invalid deletion on line " + lineNumber + ", start is after end.");
                return;
            }

            document.delete(position, endPosition);
        } catch (NumberFormatException e) {
            System.err.println("Warning: Could not parse position or length on line " + lineNumber + ": " + line);
        }
    }
}