package edu.rice.cs.drjava.model;

import java.util.ArrayList;
import java.util.List;

public class TextChangeLogger {

    public static class TextChange {
        public final String text;
        public final int offset;
        public final long timestamp;
        public final boolean isInsertion;

        public TextChange(String text, int offset, long timestamp, boolean isInsertion) {
            this.text = text;
            this.offset = offset;
            this.timestamp = timestamp;
            this.isInsertion = isInsertion;
        }

        @Override
        public String toString() {
            return String.format("[%d] %s at %d: '%s'",
                timestamp, isInsertion ? "INSERT" : "DELETE", offset, text);
        }
    }

    private final List<TextChange> changes;

    public TextChangeLogger() {
        this.changes = new ArrayList<>();
        System.out.println("--- TextChangeLogger Initialized ---");
    }

    public void logInsertion(int offset, String text) {
        long timestamp = System.currentTimeMillis();
        TextChange change = new TextChange(text, offset, timestamp, true);
        changes.add(change);
        System.out.println("LOG: " + change);
    }

    public void logDeletion(int offset, String text) {
        long timestamp = System.currentTimeMillis();
        TextChange change = new TextChange(text, offset, timestamp, false);
        changes.add(change);
        System.out.println("LOG: " + change);
    }

    public List<TextChange> getChanges() {
        return new ArrayList<>(changes);
    }

    public void clearLog() {
        changes.clear();
    }
} 