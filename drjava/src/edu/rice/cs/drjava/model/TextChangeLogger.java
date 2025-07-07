package edu.rice.cs.drjava.model;

import javax.swing.event.DocumentEvent;
import javax.swing.event.DocumentListener;
import java.util.ArrayList;
import java.util.List;
import edu.rice.cs.drjava.model.OpenDefinitionsDocument;

public class TextChangeLogger implements DocumentListener {

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
    private final OpenDefinitionsDocument doc;

    public TextChangeLogger(OpenDefinitionsDocument doc) {
        this.doc = doc;
        this.changes = new ArrayList<>();
    }

    @Override
    public void insertUpdate(DocumentEvent e) {
        try {
            String text = doc.getText(e.getOffset(), e.getLength());
            long timestamp = System.currentTimeMillis();
            TextChange change = new TextChange(text, e.getOffset(), timestamp, true);
            changes.add(change);
            System.out.println("LOG: " + change);
        } catch (Exception ex) {
            ex.printStackTrace();
        }
    }

    @Override
    public void removeUpdate(DocumentEvent e) {
        // Note: For deletions, we need to capture text before it's removed
        // This will be handled in DefinitionsDocument.remove() method
        TextChange change = new TextChange("", e.getOffset(), System.currentTimeMillis(), false);
        changes.add(change);
        System.out.println("LOG: " + change);
    }

    @Override
    public void changedUpdate(DocumentEvent e) {
        // Usually not needed for plain text documents
    }

    public List<TextChange> getChanges() {
        return new ArrayList<>(changes);
    }

    public void clearLog() {
        changes.clear();
    }
}