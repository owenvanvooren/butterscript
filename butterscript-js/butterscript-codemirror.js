/**
 * Butterscript CodeMirror Integration
 * Implements syntax highlighting for butterscript in CodeMirror
 */

// Define the butterscript mode using CodeMirror's simple mode
CodeMirror.defineSimpleMode("butterscript", {
  // The start state contains the rules that are initially used
  start: [
    // Element definitions (e.g., "heading1 [")
    {regex: /^(heading[1-6]|paragraph|list|orderedlist|item|group|link|image|divider|linebreak|quote|code|preformatted|table|row|cell|header|button|input|form|span)(\.[^(\[]+)?(\([^)]*\))?\s*(\[)(?!\])/, 
     token: ["keyword", "attribute", "string", "bracket"], 
     indent: true},
    
    // Inline elements (e.g., "heading1 [Title]") - capture content properly
    {regex: /^(heading[1-6]|paragraph|list|orderedlist|item|group|link|image|divider|linebreak|quote|code|preformatted|table|row|cell|header|button|input|form|span)(\.[^(\[]+)?(\([^)]*\))?\s*\[([^\]]*)\]$/,
     token: ["keyword", "attribute", "string", "string"]},
     
    // Self-closing elements (e.g., "image(source: "image.jpg")")
    {regex: /^(image|linebreak|divider|input)(\.[^(\[]+)?(\([^)]*\))?$/,
     token: ["keyword", "attribute", "string"]},
    
    // Element modifiers (e.g., ".bold", ".italic")
    {regex: /(?:^|\s+)\.(bold|italic|underline|strikethrough|highlight|textcolor|code|font|size|fill|radius)\b/,
     token: "attribute"},
    
    // Parameters in parentheses
    {regex: /(\w+):\s*["']([^"']+)["']/g,
     token: ["attribute", null]},
    
    // Closing brackets
    {regex: /^\]$/, token: "bracket", dedent: true},
    
    // Comment (e.g., "<--(comment)")
    {regex: /<--\([^)]*\)/, token: "comment"},
    
    // Snippet syntax (e.g., "snippet[text]")
    {regex: /\bsnippet\s*\[([^\]]*)\]/g,
     token: "variable"},
    
    // Chained modifiers (e.g., ".bold.italic")
    {regex: /(?:^|\s+|snippet\s*\[.*?\])\.(bold|italic|underline|strikethrough|highlight|textcolor|code|font|size|fill|radius)(\(([^)]*)\))?/g,
     token: "attribute"}
  ],
  
  // The meta property contains global information about the mode
  meta: {
    lineComment: "<--(",
    closeBrackets: {pairs: "[]{}()\"'", closeBefore: ")]}'\""},
    dontIndentStates: ["comment"],
    electricInput: /^\s*\]$/,
    blockCommentStart: "<--(",
    blockCommentEnd: ")",
    fold: "brace"
  }
});

// Initialize CodeMirror editor
let editor;
let originalTextarea;

// Custom suggestion popup
class ButterscriptSuggestions {
    constructor(editor) {
        this.editor = editor;
        this.container = document.createElement('div');
        this.container.className = 'butterscript-suggestions';
        document.body.appendChild(this.container);
        
        this.visible = false;
        this.suggestions = [];
        this.selectedIndex = 0;
        
        // Set up event listeners
        this.setupEvents();
    }
    
    setupEvents() {
        // Handle keyboard navigation
        this.editor.on('keydown', (cm, event) => {
            if (!this.visible) return;
            
            switch (event.key) {
                case 'ArrowDown':
                    event.preventDefault();
                    this.selectNext();
                    break;
                case 'ArrowUp':
                    event.preventDefault();
                    this.selectPrevious();
                    break;
                case 'Tab':
                case 'Enter':
                    event.preventDefault();
                    this.applySelected();
                    break;
                case 'Escape':
                    event.preventDefault();
                    this.hide();
                    break;
            }
        });
        
        // Hide when clicking outside
        document.addEventListener('click', (e) => {
            if (this.visible && !this.container.contains(e.target) && !this.editor.getWrapperElement().contains(e.target)) {
                this.hide();
            }
        });
        
        // Handle mouse selection
        this.container.addEventListener('click', (e) => {
            const item = e.target.closest('.suggestion-item');
            if (item) {
                const index = Array.from(this.container.querySelectorAll('.suggestion-item')).indexOf(item);
                if (index >= 0) {
                    this.selectedIndex = index;
                    this.applySelected();
                }
            }
        });
    }
    
    show(suggestions) {
        this.suggestions = suggestions;
        this.selectedIndex = 0;
        this.visible = true;
        
        // Clear container
        this.container.innerHTML = '';
        
        // Add header
        const header = document.createElement('div');
        header.className = 'suggestions-header';
        header.textContent = 'Butterscript Suggestions';
        this.container.appendChild(header);
        
        // Add suggestions
        const list = document.createElement('div');
        list.className = 'suggestions-list';
        
        suggestions.forEach((suggestion, index) => {
            const item = document.createElement('div');
            item.className = 'suggestion-item';
            if (index === 0) item.className += ' selected';
            
            // Create icon
            const icon = document.createElement('span');
            // Use Material Symbols if specified, otherwise use Material Icons
            icon.className = suggestion.iconType === 'symbol' ? 'material-symbols-outlined suggestion-icon' : 'material-icons suggestion-icon';
            icon.textContent = suggestion.icon || 'code';
            
            // Create text
            const text = document.createElement('span');
            text.className = 'suggestion-text';
            text.textContent = suggestion.displayText || suggestion.text;
            
            // Create type badge
            const type = document.createElement('span');
            type.className = 'suggestion-type';
            type.textContent = suggestion.type || '';
            
            // Add to item
            item.appendChild(icon);
            item.appendChild(text);
            item.appendChild(type);
            
            // Add tooltip
            if (suggestion.description) {
                item.title = suggestion.description;
            }
            
            list.appendChild(item);
        });
        
        this.container.appendChild(list);
        
        // Position the container
        this.position();
    }
    
    position() {
        if (!this.visible) return;
        
        // Get cursor position in viewport coordinates
        const cursor = this.editor.getCursor();
        const cursorCoords = this.editor.cursorCoords(cursor, 'window');
        
        // Position below the cursor
        this.container.style.left = cursorCoords.left + 'px';
        this.container.style.top = (cursorCoords.bottom + 5) + 'px';
        
        // Make sure it's visible in the viewport
        const rect = this.container.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        // Adjust horizontal position if needed
        if (rect.right > viewportWidth) {
            this.container.style.left = (viewportWidth - rect.width - 10) + 'px';
        }
        
        // Adjust vertical position if needed
        if (rect.bottom > viewportHeight) {
            this.container.style.top = (cursorCoords.top - rect.height - 5) + 'px';
        }
    }
    
    hide() {
        this.visible = false;
        this.container.style.display = 'none';
    }
    
    selectNext() {
        if (this.suggestions.length === 0) return;
        
        const items = this.container.querySelectorAll('.suggestion-item');
        items[this.selectedIndex].classList.remove('selected');
        
        this.selectedIndex = (this.selectedIndex + 1) % this.suggestions.length;
        items[this.selectedIndex].classList.add('selected');
        items[this.selectedIndex].scrollIntoView({ block: 'nearest' });
    }
    
    selectPrevious() {
        if (this.suggestions.length === 0) return;
        
        const items = this.container.querySelectorAll('.suggestion-item');
        items[this.selectedIndex].classList.remove('selected');
        
        this.selectedIndex = (this.selectedIndex - 1 + this.suggestions.length) % this.suggestions.length;
        items[this.selectedIndex].classList.add('selected');
        items[this.selectedIndex].scrollIntoView({ block: 'nearest' });
    }
    
    applySelected() {
        if (this.suggestions.length === 0 || this.selectedIndex < 0) return;
        
        const suggestion = this.suggestions[this.selectedIndex];
        this.applySuggestion(suggestion);
        this.hide();
    }
    
    applySuggestion(suggestion) {
        const cursor = this.editor.getCursor();
        const line = this.editor.getLine(cursor.line);
        const lineText = line.slice(0, cursor.ch);
        
        // Determine replacement range
        let from = { line: cursor.line, ch: 0 };
        let to = { line: cursor.line, ch: cursor.ch };
        
        // Get the current word being typed
        const wordMatch = lineText.match(/[\w.]+$/);
        if (wordMatch) {
            from.ch = cursor.ch - wordMatch[0].length;
        }
        
        // Get text to insert
        let textToInsert = suggestion.snippet || suggestion.text;
        
        // Insert the text
        this.editor.replaceRange(textToInsert, from, to);
        
        // Adjust cursor position if needed
        if (suggestion.cursorOffset) {
            const newPos = {
                line: cursor.line,
                ch: from.ch + textToInsert.length + suggestion.cursorOffset
            };
            this.editor.setCursor(newPos);
        }
    }
    
    updateSuggestions() {
        if (!this.editor) return;
        
        const cursor = this.editor.getCursor();
        const line = this.editor.getLine(cursor.line);
        const lineText = line.slice(0, cursor.ch);
        const wordMatch = lineText.match(/[\w.]+$/);
        
        if (!wordMatch) {
            // Show element suggestions if at start of line or after space
            if (lineText.match(/^\s*$/) || lineText.match(/\s$/)) {
                const elementSuggestions = this.getElementSuggestions('');
                this.show(elementSuggestions);
                this.container.style.display = 'block';
            } else {
                this.hide();
            }
            return;
        }
        
        const currentWord = wordMatch[0];
        
        // Determine suggestion type based on context
        let suggestions = [];
        
        if (currentWord.includes('.')) {
            // After a dot, suggest modifiers
            const parts = currentWord.split('.');
            const prefix = parts[parts.length - 1];
            suggestions = this.getModifierSuggestions(prefix);
        } else if (lineText.match(/\([^)]*$/)) {
            // Inside parentheses, suggest parameters
            suggestions = this.getParameterSuggestions(currentWord);
        } else if (lineText.match(/snippet\s*\[\s*$/)) {
            // After snippet[, suggest snippets
            suggestions = this.getSnippetSuggestions(currentWord);
        } else {
            // By default, suggest elements
            suggestions = this.getElementSuggestions(currentWord);
        }
        
        if (suggestions.length > 0) {
            this.show(suggestions);
            this.container.style.display = 'block';
        } else {
            this.hide();
        }
    }
    
    getElementSuggestions(prefix) {
        const elements = [
            { text: 'heading1', displayText: 'heading1', type: 'element', icon: 'format_h1', iconType: 'symbol', snippet: 'heading1 [Title]', cursorOffset: -1 },
            { text: 'heading2', displayText: 'heading2', type: 'element', icon: 'format_h2', iconType: 'symbol', snippet: 'heading2 [Subtitle]', cursorOffset: -1 },
            { text: 'heading3', displayText: 'heading3', type: 'element', icon: 'format_h3', iconType: 'symbol', snippet: 'heading3 [Section]', cursorOffset: -1 },
            { text: 'heading4', displayText: 'heading4', type: 'element', icon: 'format_h4', iconType: 'symbol', snippet: 'heading4 [Subsection]', cursorOffset: -1 },
            { text: 'heading5', displayText: 'heading5', type: 'element', icon: 'format_h5', iconType: 'symbol', snippet: 'heading5 [Minor Heading]', cursorOffset: -1 },
            { text: 'heading6', displayText: 'heading6', type: 'element', icon: 'format_h6', iconType: 'symbol', snippet: 'heading6 [Small Heading]', cursorOffset: -1 },
            { text: 'title', displayText: 'title', type: 'element', icon: 'title', iconType: 'symbol', snippet: 'title [Main Title]', cursorOffset: -1 },
            { text: 'subtitle', displayText: 'subtitle', type: 'element', icon: 'subtitles', iconType: 'symbol', snippet: 'subtitle [Document Subtitle]', cursorOffset: -1 },
            { text: 'paragraph', displayText: 'paragraph', type: 'element', icon: 'notes', iconType: 'symbol', snippet: 'paragraph [Text content]', cursorOffset: -1 },
            { text: 'list', displayText: 'list', type: 'element', icon: 'format_list_bulleted', iconType: 'symbol', snippet: 'list [\n  First item\n  Second item\n  Third item\n]', cursorOffset: -15 },
            { text: 'orderedlist', displayText: 'orderedlist', type: 'element', icon: 'format_list_numbered', iconType: 'symbol', snippet: 'orderedlist [\n  First item\n  Second item\n  Third item\n]', cursorOffset: -15 },
            { text: 'item', displayText: 'item', type: 'element', icon: 'label', iconType: 'symbol', snippet: 'item [Item content]', cursorOffset: -1 },
            { text: 'image', displayText: 'image', type: 'element', icon: 'image', iconType: 'symbol', snippet: 'image(source: "image.jpg")', cursorOffset: -1 },
            { text: 'link', displayText: 'link', type: 'element', icon: 'link', iconType: 'symbol', snippet: 'link(target: "https://example.com") [Link text]', cursorOffset: -1 },
            { text: 'divider', displayText: 'divider', type: 'element', icon: 'horizontal_rule', iconType: 'symbol', snippet: 'divider', cursorOffset: 0 },
            { text: 'divider with thickness', displayText: 'divider with thickness', type: 'element', icon: 'horizontal_rule', iconType: 'symbol', snippet: 'divider(thickness: "2px")', cursorOffset: -2 },
            { text: 'linebreak', displayText: 'linebreak', type: 'element', icon: 'keyboard_return', iconType: 'symbol', snippet: 'linebreak', cursorOffset: 0 },
            { text: 'linebreak with count', displayText: 'linebreak with count', type: 'element', icon: 'keyboard_return', iconType: 'symbol', snippet: 'linebreak(count: "2")', cursorOffset: -2 },
            { text: 'linebreak multiple', displayText: 'linebreak(3)', type: 'element', icon: 'keyboard_return', iconType: 'symbol', snippet: 'linebreak(3)', cursorOffset: -1 },
            { text: 'quote', displayText: 'quote', type: 'element', icon: 'format_quote', iconType: 'symbol', snippet: 'quote [Quoted text]', cursorOffset: -1 },
            { text: 'code', displayText: 'code', type: 'element', icon: 'code', iconType: 'symbol', snippet: 'code [Code snippet]', cursorOffset: -1 },
            { text: 'preformatted', displayText: 'preformatted', type: 'element', icon: 'code_blocks', iconType: 'symbol', snippet: 'preformatted [\nfunction example() {\n  console.log("Hello");\n}\n]', cursorOffset: -2 },
            { text: 'group', displayText: 'group', type: 'element', icon: 'folder', iconType: 'symbol', snippet: 'group [\n  \n]', cursorOffset: -2 },
            { text: 'span', displayText: 'span', type: 'element', icon: 'text_fields', iconType: 'symbol', snippet: 'span [Text]', cursorOffset: -1 },
            { text: 'table', displayText: 'table', type: 'element', icon: 'table', iconType: 'symbol', snippet: 'table [\n  row [\n    header [Column 1]\n    header [Column 2]\n  ]\n  row [\n    cell [Data 1]\n    cell [Data 2]\n  ]\n]', cursorOffset: -2 },
            { text: 'button', displayText: 'button', type: 'element', icon: 'smart_button', iconType: 'symbol', snippet: 'button [Button text]', cursorOffset: -1 },
            { text: 'form', displayText: 'form', type: 'element', icon: 'list_alt_check', iconType: 'symbol', snippet: 'form(action: "/submit") [\n  \n]', cursorOffset: -2 },
            { text: 'input', displayText: 'input', type: 'element', icon: 'input', iconType: 'symbol', snippet: 'input(type: "text", placeholder: "Enter text")', cursorOffset: 0 }
        ];
        
        if (!prefix) return elements;
        
        return elements.filter(element => 
            element.text.toLowerCase().includes(prefix.toLowerCase())
        );
    }
    
    getModifierSuggestions(prefix) {
        const modifiers = [
            { text: 'bold', displayText: '.bold', type: 'modifier', icon: 'format_bold', iconType: 'symbol' },
            { text: 'italic', displayText: '.italic', type: 'modifier', icon: 'format_italic', iconType: 'symbol' },
            { text: 'underline', displayText: '.underline', type: 'modifier', icon: 'format_underlined', iconType: 'symbol' },
            { text: 'code', displayText: '.code', type: 'modifier', icon: 'code', iconType: 'symbol' },
            { text: 'strikethrough', displayText: '.strikethrough', type: 'modifier', icon: 'strikethrough_s', iconType: 'symbol' },
            { text: 'highlight', displayText: '.highlight', type: 'modifier', icon: 'format_ink_highlighter', iconType: 'symbol' },
 
            { text: 'highlight with color', displayText: '.highlight(...)', type: 'modifier', icon: 'format_color_fill', iconType: 'symbol', snippet: '.highlight(.yellow)' },
            { text: 'textcolor', displayText: '.textcolor(...)', type: 'modifier', icon: 'palette', iconType: 'symbol', snippet: '.textcolor(.blue)' },
            { text: 'font', displayText: '.font(...)', type: 'modifier', icon: 'font_download', iconType: 'symbol', snippet: '.font(.sans)' },
            { text: 'font sans', displayText: '.font(.sans)', type: 'modifier', icon: 'font_download', iconType: 'symbol', snippet: '.font(.sans)' },
            { text: 'font serif', displayText: '.font(.serif)', type: 'modifier', icon: 'font_download', iconType: 'symbol', snippet: '.font(.serif)' },
            { text: 'font monospace', displayText: '.font(.monospace)', type: 'modifier', icon: 'code', iconType: 'symbol', snippet: '.font(.monospace)' },
            { text: 'size', displayText: '.size(...)', type: 'modifier', icon: 'aspect_ratio', iconType: 'symbol', snippet: '.size(width:300px,height:auto)' },
            { text: 'radius', displayText: '.radius(...)', type: 'modifier', icon: 'rounded_corner', iconType: 'symbol', snippet: '.radius(8px)' }
        ];
        
        if (!prefix) return modifiers;
        
        return modifiers.filter(modifier => 
            modifier.text.toLowerCase().includes(prefix.toLowerCase())
        );
    }
    
    getParameterSuggestions(prefix) {
        const parameters = [
            { text: 'target', displayText: 'target: "..."', type: 'param', icon: 'link', iconType: 'symbol', snippet: 'target: ""', cursorOffset: -1 },
            { text: 'source', displayText: 'source: "..."', type: 'param', icon: 'image', iconType: 'symbol', snippet: 'source: ""', cursorOffset: -1 },
            { text: 'alt', displayText: 'alt: "..."', type: 'param', icon: 'description', iconType: 'symbol', snippet: 'alt: ""', cursorOffset: -1 },
            { text: 'width', displayText: 'width: "..."', type: 'param', icon: 'width', iconType: 'symbol', snippet: 'width: "300px"', cursorOffset: -3 },
            { text: 'height', displayText: 'height: "..."', type: 'param', icon: 'height', iconType: 'symbol', snippet: 'height: "200px"', cursorOffset: -3 },
            { text: 'color', displayText: 'color: "..."', type: 'param', icon: 'color_lens', iconType: 'symbol', snippet: 'color: "#4285F4"', cursorOffset: -1 },
            { text: 'size', displayText: 'size: "..."', type: 'param', icon: 'format_size', iconType: 'symbol', snippet: 'size: "16px"', cursorOffset: -1 },
            { text: 'type', displayText: 'type: "..."', type: 'param', icon: 'category', iconType: 'symbol', snippet: 'type: "text"', cursorOffset: -1 },
            { text: 'placeholder', displayText: 'placeholder: "..."', type: 'param', icon: 'text_format', iconType: 'symbol', snippet: 'placeholder: ""', cursorOffset: -1 },
            { text: 'textcolor', displayText: 'textcolor: "..."', type: 'param', icon: 'palette', iconType: 'symbol', snippet: 'textcolor: "#333333"', cursorOffset: -1 },
            { text: 'bgcolor', displayText: 'bgcolor: "..."', type: 'param', icon: 'format_color_fill', iconType: 'symbol', snippet: 'bgcolor: "#f1f1f1"', cursorOffset: -1 },
            { text: 'radius', displayText: 'radius: "..."', type: 'param', icon: 'rounded_corner', iconType: 'symbol', snippet: 'radius: "8px"', cursorOffset: -3 },
            { text: 'thickness', displayText: 'thickness: "..."', type: 'param', icon: 'height', iconType: 'symbol', snippet: 'thickness: "2px"', cursorOffset: -3 },
            { text: 'count', displayText: 'count: "..."', type: 'param', icon: 'keyboard_return', iconType: 'symbol', snippet: 'count: "2"', cursorOffset: -2 },
            { text: 'id', displayText: 'id: "..."', type: 'param', icon: 'tag', iconType: 'symbol', snippet: 'id: "my-element"', cursorOffset: -1 },
            { text: 'do', displayText: 'do: "..."', type: 'param', icon: 'play_arrow', iconType: 'symbol', snippet: 'do: "action:targetId"', cursorOffset: -1 }
        ];
        
        if (!prefix) return parameters;
        
        return parameters.filter(param => 
            param.text.toLowerCase().includes(prefix.toLowerCase())
        );
    }
    
    getSnippetSuggestions(prefix) {
        return [
            { text: 'snippet', displayText: 'snippet[...]', type: 'snippet', icon: 'label', description: 'Create a formatted snippet', snippet: 'snippet[]', cursorOffset: -1 }
        ];
    }
}

// Initialize the CodeMirror editor when the DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Get the original textarea
    originalTextarea = document.getElementById('butterscript-input');
    
    // If the textarea exists, replace it with CodeMirror
    if (originalTextarea) {
        // Initialize CodeMirror editor
        editor = CodeMirror(function(elt) {
            // Replace the textarea with the CodeMirror instance
            originalTextarea.parentNode.replaceChild(elt, originalTextarea);
        }, {
            value: originalTextarea.value,
            mode: "butterscript", // Use our custom butterscript mode
            theme: "midnight", // Base theme, but we'll override most styles
            lineWrapping: true,
            lineNumbers: false,
            matchBrackets: true,
            autoCloseBrackets: {
                pairs: '[]{}()"\'',
                override: true
            },
            styleActiveLine: true,
            tabSize: 2,
            indentWithTabs: false,
            extraKeys: {
                "Tab": function(cm) {
                    // Check if our custom suggestions are visible
                    const container = document.getElementById('custom-suggestions');
                    const selected = container?.querySelector('.suggestion-item.selected');
                    
                    // If suggestions are visible and there's a selected item, accept it
                    if (container && container.style.display === 'block' && selected) {
                        const suggestion = selected.dataset.suggestion;
                        if (suggestion) {
                            insertSuggestion(JSON.parse(suggestion));
                            container.style.display = 'none';
                            container.dataset.userNavigated = 'false';
                            return;
                        }
                    }
                    
                    // If no suggestions or no active selection, insert spaces
                    cm.replaceSelection("  ", "end");
                },
                "Ctrl-Space": function() {
                    showSuggestions();
                }
            }
        });
        
        // Add the custom class to the CodeMirror wrapper
        editor.getWrapperElement().classList.add('butterscript-editor');
        
        // Set up events to sync with original functionality
        editor.on('change', function() {
            // Sync content back to original textarea (required for some existing functions)
            originalTextarea.value = editor.getValue();
            
            // Trigger the original update function
            updatePreview();
            
            // Show suggestions
            showSuggestions();
        });
        
        // Show suggestions on input
        editor.on('inputRead', function() {
            showSuggestions();
        });
        
        // Show suggestions when the editor gains focus
        editor.on('focus', function() {
            showSuggestions();
        });
        
        // Update suggestion position on cursor movement
        editor.on('cursorActivity', function() {
            // Save cursor position in the original textarea for autocomplete positioning
            const cursor = editor.getCursor();
            const pos = editor.indexFromPos(cursor);
            originalTextarea.selectionStart = originalTextarea.selectionEnd = pos;
            
            // Reposition suggestions if they're visible
            const container = document.getElementById('custom-suggestions');
            if (container && container.style.display === 'block') {
                positionSuggestions(container);
            }
        });
        
        // Initialize with content and trigger preview update
        updatePreview();
        
        // Show initial suggestions after a delay
        setTimeout(function() {
            showSuggestions();
        }, 500);
        
        // Update status bar
        const lineCount = document.getElementById('line-count');
        if (lineCount) {
            const lines = editor.lineCount();
            const chars = editor.getValue().length;
            lineCount.innerHTML = `Lines: ${lines} • Characters: ${chars} • <span class="autocomplete-status">Tab: Accept suggestion • ↑↓: Navigate • Esc: Dismiss</span>`;
        }
    } else {
        console.error("Textarea not found!");
    }
});

// Override the original functions to work with CodeMirror
// Save references to the original functions
const originalUpdatePreview = window.updatePreview;
const originalFormatCode = window.formatCode;
const originalGetSelectedText = window.getSelectedText;
const originalFindInText = window.findInText;
const originalReplaceText = window.replaceText;
const originalReplaceAllMatches = window.replaceAllMatches;
const originalSelectMatch = window.selectMatch;
const originalCopyCode = window.copyCode;
const originalCopyButterscript = window.copyButterscript;

// Override updatePreview
window.updatePreview = function() {
    if (editor) {
        const butterscriptCode = editor.getValue();
        const html = parser.parse(butterscriptCode);
        preview.innerHTML = html;

        // Update status bar
        const lines = butterscriptCode.split('\n').length;
        const chars = butterscriptCode.length;
        lineCount.textContent = `Lines: ${lines} • Characters: ${chars}`;
    } else {
        // Fall back to original function if editor not initialized
        originalUpdatePreview();
    }
};

// Override formatCode
window.formatCode = function() {
    if (editor) {
        const code = editor.getValue();
        const lines = code.split('\n');
        let formatted = '';
        let indentLevel = 0;

        for (const line of lines) {
            const trimmed = line.trim();

            if (trimmed === ']') {
                indentLevel = Math.max(0, indentLevel - 1);
                formatted += '  '.repeat(indentLevel) + trimmed + '\n';
            } else {
                formatted += '  '.repeat(indentLevel) + trimmed + '\n';

                if (trimmed.endsWith('[') && !trimmed.includes(']')) {
                    indentLevel++;
                }
            }
        }

        editor.setValue(formatted.trim());
        showToast('Code formatted!');
    } else {
        originalFormatCode();
    }
};

// Override getSelectedText
window.getSelectedText = function() {
    if (editor) {
        return editor.getSelection();
    } else {
        return originalGetSelectedText();
    }
};

// Override findInText
window.findInText = function() {
    if (editor) {
        const searchTerm = findInput.value;
        const text = editor.getValue();
        
        // Clear previous matches
        clearMatches();
        
        if (!searchTerm) {
            updateMatchCount();
            return;
        }
        
        // Find all occurrences
        let searchCursor = editor.getSearchCursor(searchTerm);
        while (searchCursor.findNext()) {
            matches.push({
                start: editor.indexFromPos(searchCursor.from()),
                end: editor.indexFromPos(searchCursor.to()),
                from: searchCursor.from(),
                to: searchCursor.to()
            });
        }
        
        updateMatchCount();
        
        // Select first match if any
        if (matches.length > 0) {
            selectMatch(0);
        }
    } else {
        originalFindInText();
    }
};

// Override selectMatch
window.selectMatch = function(index) {
    if (editor && matches.length > 0 && index >= 0 && index < matches.length) {
        currentMatchIndex = index;
        const match = matches[index];
        
        // Select the text in the editor
        editor.setSelection(match.from, match.to);
        
        // Ensure the selected text is visible
        editor.scrollIntoView({ from: match.from, to: match.to }, 50);
        
        updateMatchCount();
    } else if (originalSelectMatch) {
        originalSelectMatch(index);
    }
};

// Override replaceText for find/replace
window.replaceMatch = function() {
    if (editor && matches.length > 0 && currentMatchIndex !== -1) {
        const match = matches[currentMatchIndex];
        const replaceText = replaceInput.value;
        
        // Replace in editor
        editor.replaceRange(replaceText, match.from, match.to);
        
        // Refresh the matches as the text has changed
        findInText();
    } else if (originalReplaceText) {
        originalReplaceText();
    }
};

// Override replaceAllMatches
window.replaceAllMatches = function() {
    if (editor) {
        const searchTerm = findInput.value;
        const replaceText = replaceInput.value;
        
        if (!searchTerm || matches.length === 0) return;
        
        // Start from the end to avoid position shifts
        for (let i = matches.length - 1; i >= 0; i--) {
            const match = matches[i];
            editor.replaceRange(replaceText, match.from, match.to);
        }
        
        // Show count of replacements
        showToast(`${matches.length} occurrences replaced`);
        
        // Clear matches and refresh
        clearMatches();
        findInText();
    } else if (originalReplaceAllMatches) {
        originalReplaceAllMatches();
    }
};

// Override copy functions
window.copyCode = window.copyButterscript = function() {
    if (editor) {
        navigator.clipboard.writeText(editor.getValue());
        showToast('butterscript code copied!');
    } else if (originalCopyButterscript) {
        originalCopyButterscript();
    }
};

// Override loadExample to work with CodeMirror
const originalLoadExample = window.loadExample;
window.loadExample = function() {
    if (originalLoadExample) {
        originalLoadExample();
        // If we have CodeMirror editor, sync content from the textarea
        if (editor && originalTextarea) {
            editor.setValue(originalTextarea.value);
        }
    }
};

// Make sure CodeMirror works with ButterscriptAutocomplete if available
document.addEventListener('DOMContentLoaded', function() {
    if (typeof ButterscriptAutocomplete !== 'undefined') {
        // Initialize autocomplete with a hidden instance for use with CodeMirror
        window.autocomplete = new ButterscriptAutocomplete(originalTextarea, parser);
    }
});

// Show autocompletion if needed
function showAutocompletionIfNeeded() {
    if (!editor) {
        console.error("Editor not initialized");
        return;
    }
    
    try {
        // Force CodeMirror to use its autocomplete command directly
        CodeMirror.commands.autocomplete(editor, null, {
            hint: function(cm) {
                // Create basic suggestions
                const cursor = cm.getCursor();
                const token = cm.getTokenAt(cursor);
                
                // Create some basic suggestions
                const list = [
                    {text: "heading1", displayText: "heading1"},
                    {text: "heading2", displayText: "heading2"},
                    {text: "paragraph", displayText: "paragraph"},
                    {text: "list", displayText: "list"},
                    {text: "image", displayText: "image"},
                    {text: "link", displayText: "link"}
                ];
                
                return {
                    list: list,
                    from: CodeMirror.Pos(cursor.line, token.start),
                    to: CodeMirror.Pos(cursor.line, token.end)
                };
            },
            completeSingle: false,
            alignWithWord: true,
            closeOnUnfocus: false
        });
    } catch (error) {
        console.error("Error showing autocomplete:", error);
    }
}

// Add a custom suggestions panel to the editor
function addCustomSuggestions() {
    if (!editor) return;
    
    // Create suggestions container if it doesn't exist
    let container = document.getElementById('custom-suggestions');
    if (!container) {
        container = document.createElement('div');
        container.id = 'custom-suggestions';
        container.className = 'custom-suggestions';
        document.body.appendChild(container);
        
        // Add suggestions list
        const list = document.createElement('div');
        list.className = 'suggestions-list';
        container.appendChild(list);
        
        // Add keyboard navigation
        editor.getWrapperElement().addEventListener('keydown', function(e) {
            const container = document.getElementById('custom-suggestions');
            if (!container || container.style.display === 'none') return;
            
            const list = container.querySelector('.suggestions-list');
            const items = list.querySelectorAll('.suggestion-item');
            const selected = list.querySelector('.suggestion-item.selected');
            const selectedIndex = Array.from(items).indexOf(selected);
            
            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault(); // Prevent scrolling the editor
                    e.stopPropagation(); // Stop CodeMirror from handling this key
                    if (selectedIndex < items.length - 1) {
                        if (selected) selected.classList.remove('selected');
                        items[selectedIndex + 1].classList.add('selected');
                        items[selectedIndex + 1].scrollIntoView({ block: 'nearest' });
                        // Set user has navigated flag
                        container.dataset.userNavigated = 'true';
                    }
                    break;
                case 'ArrowUp':
                    e.preventDefault(); // Prevent scrolling the editor
                    e.stopPropagation(); // Stop CodeMirror from handling this key
                    if (selectedIndex > 0) {
                        if (selected) selected.classList.remove('selected');
                        items[selectedIndex - 1].classList.add('selected');
                        items[selectedIndex - 1].scrollIntoView({ block: 'nearest' });
                        // Set user has navigated flag
                        container.dataset.userNavigated = 'true';
                    }
                    break;
                case 'Tab':
                    e.preventDefault();
                    e.stopPropagation();
                    if (selected) {
                        const suggestion = selected.dataset.suggestion;
                        if (suggestion) {
                            insertSuggestion(JSON.parse(suggestion));
                            container.style.display = 'none';
                            container.dataset.userNavigated = 'false';
                        }
                    }
                    break;
                case 'Enter':
                    // Only handle Enter if user has navigated with arrow keys
                    if (container.dataset.userNavigated === 'true') {
                        e.preventDefault();
                        e.stopPropagation();
                        if (selected) {
                            const suggestion = selected.dataset.suggestion;
                            if (suggestion) {
                                insertSuggestion(JSON.parse(suggestion));
                                container.style.display = 'none';
                                container.dataset.userNavigated = 'false';
                            }
                        }
                    }
                    break;
                case 'Escape':
                    e.preventDefault();
                    container.style.display = 'none';
                    container.dataset.userNavigated = 'false';
                    break;
            }
        }, true); // Add capturing phase to intercept events before CodeMirror
        
        // Handle clicks on suggestions
        list.addEventListener('click', function(e) {
            const item = e.target.closest('.suggestion-item');
            if (item) {
                const suggestion = item.dataset.suggestion;
                if (suggestion) {
                    insertSuggestion(JSON.parse(suggestion));
                    container.style.display = 'none';
                    container.dataset.userNavigated = 'false';
                }
            }
        });
        
        // Initialize user navigation state
        container.dataset.userNavigated = 'false';
    }
    
    return container;
}

// Show suggestions based on current context
function showSuggestions() {
    const container = addCustomSuggestions();
    if (!container) return;
    
    const list = container.querySelector('.suggestions-list');
    if (!list) return;
    
    // Clear previous suggestions
    list.innerHTML = '';
    
    // Get cursor position
    const cursor = editor.getCursor();
    const line = editor.getLine(cursor.line);
    const lineBeforeCursor = line.substring(0, cursor.ch);
    
    // Determine what suggestions to show
    let suggestions = [];
    
    if (lineBeforeCursor.match(/\.[\w]*$/)) {
        // After a dot, suggest modifiers
        suggestions = getModifierSuggestions(lineBeforeCursor);
    } else if (lineBeforeCursor.match(/\([\w]*$/)) {
        // Inside parentheses, suggest parameters
        suggestions = getParameterSuggestions(lineBeforeCursor);
    } else {
        // By default, suggest elements
        suggestions = getElementSuggestions(lineBeforeCursor);
    }
    
    // If no suggestions, hide container
    if (suggestions.length === 0) {
        container.style.display = 'none';
        return;
    }
    
    // Add suggestions to the list
    suggestions.forEach((suggestion, index) => {
        const item = document.createElement('div');
        item.className = 'suggestion-item';
        if (index === 0) item.className += ' selected';
        
        // Store suggestion data
        item.dataset.suggestion = JSON.stringify(suggestion);
        
        // Icon
        const icon = document.createElement('span');
        // Use Material Symbols if specified, otherwise use Material Icons
        icon.className = suggestion.iconType === 'symbol' ? 'material-symbols-outlined suggestion-icon' : 'material-icons suggestion-icon';
        icon.textContent = suggestion.icon || 'code';
        
        // Text
        const text = document.createElement('span');
        text.className = 'suggestion-text';
        text.textContent = suggestion.displayText || suggestion.text;
        
        // Type
        const type = document.createElement('span');
        type.className = 'suggestion-type';
        type.textContent = suggestion.type || '';
        
        item.appendChild(icon);
        item.appendChild(text);
        item.appendChild(type);
        
        list.appendChild(item);
    });
    
    // Position container
    positionSuggestions(container);
    
    // Show container
    container.style.display = 'block';
    
    // Reset user navigation state
    container.dataset.userNavigated = 'false';
}

// Position the suggestions container
function positionSuggestions(container) {
    // Get cursor position in the editor
    const cursor = editor.getCursor();
    const cursorCoords = editor.cursorCoords(cursor, 'window');
    
    // Get editor dimensions
    const editorRect = editor.getWrapperElement().getBoundingClientRect();
    
    // Calculate position - place below the cursor
    let top = cursorCoords.bottom + 5; // 5px below cursor
    let left = cursorCoords.left;
    
    // Make sure the container doesn't go beyond the right edge of the editor
    const containerWidth = 300; // Approximate width
    if (left + containerWidth > editorRect.right) {
        left = Math.max(editorRect.right - containerWidth, editorRect.left);
    }
    
    // Set position
    container.style.top = `${top}px`;
    container.style.left = `${left}px`;
    
    // Add a small arrow pointing to the cursor
    let arrow = container.querySelector('.suggestion-arrow');
    if (!arrow) {
        arrow = document.createElement('div');
        arrow.className = 'suggestion-arrow';
        container.insertBefore(arrow, container.firstChild);
    }
    
    // Position the arrow to point at the cursor
    const arrowLeft = Math.max(5, Math.min(cursorCoords.left - left, containerWidth - 10));
    arrow.style.left = `${arrowLeft}px`;
}

// Insert selected suggestion
function insertSuggestion(suggestion) {
    if (!suggestion) return;
    
    const cursor = editor.getCursor();
    const line = editor.getLine(cursor.line);
    const lineBeforeCursor = line.substring(0, cursor.ch);
    
    // Determine start position based on context
    let startPos = cursor;
    let endPos = cursor;
    
    if (lineBeforeCursor.match(/\.[\w]*$/)) {
        // After a dot, replace the word after the dot
        const match = lineBeforeCursor.match(/\.(\w*)$/);
        if (match) {
            const dotIndex = lineBeforeCursor.lastIndexOf('.');
            startPos = {line: cursor.line, ch: dotIndex + 1};
            endPos = cursor;
        }
        
        // Use snippet if provided, otherwise just the text
        const insertText = suggestion.snippet || '.' + suggestion.text;
        editor.replaceRange(insertText, startPos, endPos);
        
    } else if (lineBeforeCursor.match(/\([\w]*$/)) {
        // Inside parentheses, replace text after the open parenthesis
        const match = lineBeforeCursor.match(/\((\w*)$/);
        if (match) {
            const parenIndex = lineBeforeCursor.lastIndexOf('(');
            startPos = {line: cursor.line, ch: parenIndex + 1};
            endPos = cursor;
        }
        
        // Use snippet if provided, otherwise just the text
        const insertText = suggestion.snippet || suggestion.text;
        editor.replaceRange(insertText, startPos, endPos);
        
    } else {
        // For elements, replace the current word
        const wordMatch = lineBeforeCursor.match(/\w+$/);
        if (wordMatch) {
            const wordStart = lineBeforeCursor.length - wordMatch[0].length;
            startPos = {line: cursor.line, ch: wordStart};
            endPos = cursor;
        }
        
        // Use snippet if provided, otherwise just the text
        const insertText = suggestion.snippet || suggestion.text;
        editor.replaceRange(insertText, startPos, endPos);
    }
    
    // Handle cursor offset if specified
    if (suggestion.cursorOffset && suggestion.cursorOffset !== 0) {
        const newPos = editor.getCursor();
        const adjustedPos = {
            line: newPos.line,
            ch: newPos.ch + suggestion.cursorOffset
        };
        editor.setCursor(adjustedPos);
    }
    
    // Focus the editor
    editor.focus();
    
    // Trigger update
    const originalTextarea = document.getElementById('butterscript-input');
    if (originalTextarea) {
        originalTextarea.value = editor.getValue();
        updatePreview();
    }
}

// Get element suggestions with fuzzy matching
function getElementSuggestions(text) {
    const elements = [
        { text: 'heading1', displayText: 'heading1', type: 'element', icon: 'format_h1', iconType: 'symbol', snippet: 'heading1 [Title]', cursorOffset: -1 },
        { text: 'heading2', displayText: 'heading2', type: 'element', icon: 'format_h2', iconType: 'symbol', snippet: 'heading2 [Subtitle]', cursorOffset: -1 },
        { text: 'heading3', displayText: 'heading3', type: 'element', icon: 'format_h3', iconType: 'symbol', snippet: 'heading3 [Section]', cursorOffset: -1 },
        { text: 'heading4', displayText: 'heading4', type: 'element', icon: 'format_h4', iconType: 'symbol', snippet: 'heading4 [Subsection]', cursorOffset: -1 },
        { text: 'heading5', displayText: 'heading5', type: 'element', icon: 'format_h5', iconType: 'symbol', snippet: 'heading5 [Minor Heading]', cursorOffset: -1 },
        { text: 'heading6', displayText: 'heading6', type: 'element', icon: 'format_h6', iconType: 'symbol', snippet: 'heading6 [Small Heading]', cursorOffset: -1 },
        { text: 'title', displayText: 'title', type: 'element', icon: 'title', iconType: 'symbol', snippet: 'title [Main Title]', cursorOffset: -1 },
        { text: 'subtitle', displayText: 'subtitle', type: 'element', icon: 'subtitles', iconType: 'symbol', snippet: 'subtitle [Document Subtitle]', cursorOffset: -1 },
        { text: 'paragraph', displayText: 'paragraph', type: 'element', icon: 'notes', iconType: 'symbol', snippet: 'paragraph [Text content]', cursorOffset: -1 },
        { text: 'list', displayText: 'list', type: 'element', icon: 'format_list_bulleted', iconType: 'symbol', snippet: 'list [\n  First item\n  Second item\n  Third item\n]', cursorOffset: -15 },
        { text: 'orderedlist', displayText: 'orderedlist', type: 'element', icon: 'format_list_numbered', iconType: 'symbol', snippet: 'orderedlist [\n  First item\n  Second item\n  Third item\n]', cursorOffset: -15 },
        { text: 'item', displayText: 'item', type: 'element', icon: 'label', iconType: 'symbol', snippet: 'item [Item content]', cursorOffset: -1 },
        { text: 'image', displayText: 'image', type: 'element', icon: 'image', iconType: 'symbol', snippet: 'image(source: "image.jpg")', cursorOffset: -1 },
        { text: 'link', displayText: 'link', type: 'element', icon: 'link', iconType: 'symbol', snippet: 'link(target: "https://example.com") [Link text]', cursorOffset: -1 },
        { text: 'divider', displayText: 'divider', type: 'element', icon: 'horizontal_rule', iconType: 'symbol', snippet: 'divider', cursorOffset: 0 },
        { text: 'divider with thickness', displayText: 'divider with thickness', type: 'element', icon: 'horizontal_rule', iconType: 'symbol', snippet: 'divider(thickness: "2px")', cursorOffset: -2 },
        { text: 'linebreak', displayText: 'linebreak', type: 'element', icon: 'keyboard_return', iconType: 'symbol', snippet: 'linebreak', cursorOffset: 0 },
        { text: 'linebreak with count', displayText: 'linebreak with count', type: 'element', icon: 'keyboard_return', iconType: 'symbol', snippet: 'linebreak(count: "2")', cursorOffset: -2 },
        { text: 'linebreak multiple', displayText: 'linebreak(3)', type: 'element', icon: 'keyboard_return', iconType: 'symbol', snippet: 'linebreak(3)', cursorOffset: -1 },
        { text: 'quote', displayText: 'quote', type: 'element', icon: 'format_quote', iconType: 'symbol', snippet: 'quote [Quoted text]', cursorOffset: -1 },
        { text: 'code', displayText: 'code', type: 'element', icon: 'code', iconType: 'symbol', snippet: 'code [Code snippet]', cursorOffset: -1 },
        { text: 'preformatted', displayText: 'preformatted', type: 'element', icon: 'code_blocks', iconType: 'symbol', snippet: 'preformatted [\nfunction example() {\n  console.log("Hello");\n}\n]', cursorOffset: -2 },
        { text: 'group', displayText: 'group', type: 'element', icon: 'folder', iconType: 'symbol', snippet: 'group [\n  \n]', cursorOffset: -2 },
        { text: 'span', displayText: 'span', type: 'element', icon: 'text_fields', iconType: 'symbol', snippet: 'span [Text]', cursorOffset: -1 },
        { text: 'table', displayText: 'table', type: 'element', icon: 'table', iconType: 'symbol', snippet: 'table [\n  row [\n    header [Column 1]\n    header [Column 2]\n  ]\n  row [\n    cell [Data 1]\n    cell [Data 2]\n  ]\n]', cursorOffset: -2 },
        { text: 'button', displayText: 'button', type: 'element', icon: 'smart_button', iconType: 'symbol', snippet: 'button [Button text]', cursorOffset: -1 },
        { text: 'form', displayText: 'form', type: 'element', icon: 'list_alt_check', iconType: 'symbol', snippet: 'form(action: "/submit") [\n  \n]', cursorOffset: -2 },
        { text: 'input', displayText: 'input', type: 'element', icon: 'input', iconType: 'symbol', snippet: 'input(type: "text", placeholder: "Enter text")', cursorOffset: 0 }
    ];
    
    // Filter by partial match if there's a word being typed
    const wordMatch = text.match(/\w+$/);
    if (wordMatch) {
        const word = wordMatch[0].toLowerCase();
        
        // Fuzzy search - match letters in order but not necessarily consecutively
        return elements.filter(element => {
            const elementText = element.text.toLowerCase();
            let j = 0;
            for (let i = 0; i < word.length; i++) {
                const char = word[i];
                j = elementText.indexOf(char, j);
                if (j === -1) return false;
                j++;
            }
            return true;
        }).sort((a, b) => {
            // Sort by exact prefix match first, then by length
            const aText = a.text.toLowerCase();
            const bText = b.text.toLowerCase();
            const aStartsWithWord = aText.startsWith(word);
            const bStartsWithWord = bText.startsWith(word);
            
            if (aStartsWithWord && !bStartsWithWord) return -1;
            if (!aStartsWithWord && bStartsWithWord) return 1;
            
            // If both or neither starts with the word, sort by length
            return aText.length - bText.length;
        });
    }
    
    return elements;
}

// Get modifier suggestions with fuzzy matching
function getModifierSuggestions(text) {
        const modifiers = [
        { text: 'bold', displayText: '.bold', type: 'modifier', icon: 'format_bold', iconType: 'symbol' },
        { text: 'italic', displayText: '.italic', type: 'modifier', icon: 'format_italic', iconType: 'symbol' },
        { text: 'underline', displayText: '.underline', type: 'modifier', icon: 'format_underlined', iconType: 'symbol' },
        { text: 'code', displayText: '.code', type: 'modifier', icon: 'code', iconType: 'symbol' },
        { text: 'strikethrough', displayText: '.strikethrough', type: 'modifier', icon: 'strikethrough_s', iconType: 'symbol' },
        { text: 'highlight', displayText: '.highlight', type: 'modifier', icon: 'format_ink_highlighter', iconType: 'symbol' },
 
        { text: 'highlight with color', displayText: '.highlight(...)', type: 'modifier', icon: 'format_color_fill', iconType: 'symbol', snippet: '.highlight(.yellow)' },
        { text: 'textcolor', displayText: '.textcolor(...)', type: 'modifier', icon: 'palette', iconType: 'symbol', snippet: '.textcolor(.blue)' },
        { text: 'font', displayText: '.font(...)', type: 'modifier', icon: 'font_download', iconType: 'symbol', snippet: '.font(.sans)' },
        { text: 'font sans', displayText: '.font(.sans)', type: 'modifier', icon: 'font_download', iconType: 'symbol', snippet: '.font(.sans)' },
        { text: 'font serif', displayText: '.font(.serif)', type: 'modifier', icon: 'font_download', iconType: 'symbol', snippet: '.font(.serif)' },
        { text: 'font monospace', displayText: '.font(.monospace)', type: 'modifier', icon: 'code', iconType: 'symbol', snippet: '.font(.monospace)' },
        { text: 'size', displayText: '.size(...)', type: 'modifier', icon: 'aspect_ratio', iconType: 'symbol', snippet: '.size(width:300px,height:auto)' },
        { text: 'radius', displayText: '.radius(...)', type: 'modifier', icon: 'rounded_corner', iconType: 'symbol', snippet: '.radius(8px)' }
    ];
    
    // Filter by partial match if there's a word after the dot
    const dotMatch = text.match(/\.(\w*)$/);
    if (dotMatch && dotMatch[1]) {
        const word = dotMatch[1].toLowerCase();
        
        // Fuzzy search - match letters in order but not necessarily consecutively
        return modifiers.filter(modifier => {
            const modifierText = modifier.text.toLowerCase();
            let j = 0;
            for (let i = 0; i < word.length; i++) {
                const char = word[i];
                j = modifierText.indexOf(char, j);
                if (j === -1) return false;
                j++;
            }
            return true;
        }).sort((a, b) => {
            // Sort by exact prefix match first, then by length
            const aText = a.text.toLowerCase();
            const bText = b.text.toLowerCase();
            const aStartsWithWord = aText.startsWith(word);
            const bStartsWithWord = bText.startsWith(word);
            
            if (aStartsWithWord && !bStartsWithWord) return -1;
            if (!aStartsWithWord && bStartsWithWord) return 1;
            
            // If both or neither starts with the word, sort by length
            return aText.length - bText.length;
        });
    }
    
    return modifiers;
}

// Get parameter suggestions with fuzzy matching
function getParameterSuggestions(text) {
    const parameters = [
        { text: 'target', displayText: 'target: "..."', type: 'param', icon: 'link', iconType: 'symbol', snippet: 'target: ""', cursorOffset: -1 },
        { text: 'source', displayText: 'source: "..."', type: 'param', icon: 'image', iconType: 'symbol', snippet: 'source: ""', cursorOffset: -1 },
        { text: 'alt', displayText: 'alt: "..."', type: 'param', icon: 'description', iconType: 'symbol', snippet: 'alt: ""', cursorOffset: -1 },
        { text: 'width', displayText: 'width: "..."', type: 'param', icon: 'width', iconType: 'symbol', snippet: 'width: "300px"', cursorOffset: -3 },
        { text: 'height', displayText: 'height: "..."', type: 'param', icon: 'height', iconType: 'symbol', snippet: 'height: "200px"', cursorOffset: -3 },
        { text: 'color', displayText: 'color: "..."', type: 'param', icon: 'color_lens', iconType: 'symbol', snippet: 'color: "#4285F4"', cursorOffset: -1 },
        { text: 'size', displayText: 'size: "..."', type: 'param', icon: 'format_size', iconType: 'symbol', snippet: 'size: "16px"', cursorOffset: -1 },
        { text: 'type', displayText: 'type: "..."', type: 'param', icon: 'category', iconType: 'symbol', snippet: 'type: "text"', cursorOffset: -1 },
        { text: 'placeholder', displayText: 'placeholder: "..."', type: 'param', icon: 'text_format', iconType: 'symbol', snippet: 'placeholder: ""', cursorOffset: -1 },
        { text: 'textcolor', displayText: 'textcolor: "..."', type: 'param', icon: 'palette', iconType: 'symbol', snippet: 'textcolor: "#333333"', cursorOffset: -1 },
        { text: 'bgcolor', displayText: 'bgcolor: "..."', type: 'param', icon: 'format_color_fill', iconType: 'symbol', snippet: 'bgcolor: "#f1f1f1"', cursorOffset: -1 },
        { text: 'radius', displayText: 'radius: "..."', type: 'param', icon: 'rounded_corner', iconType: 'symbol', snippet: 'radius: "8px"', cursorOffset: -3 },
        { text: 'thickness', displayText: 'thickness: "..."', type: 'param', icon: 'height', iconType: 'symbol', snippet: 'thickness: "2px"', cursorOffset: -3 },
        { text: 'count', displayText: 'count: "..."', type: 'param', icon: 'keyboard_return', iconType: 'symbol', snippet: 'count: "2"', cursorOffset: -2 },
        { text: 'id', displayText: 'id: "..."', type: 'param', icon: 'tag', iconType: 'symbol', snippet: 'id: "my-element"', cursorOffset: -1 },
        { text: 'do', displayText: 'do: "..."', type: 'param', icon: 'play_arrow', iconType: 'symbol', snippet: 'do: "action:targetId"', cursorOffset: -1 }
    ];
    
    // Filter by partial match if there's a word after the parenthesis
    const paramMatch = text.match(/\((\w*)$/);
    if (paramMatch && paramMatch[1]) {
        const word = paramMatch[1].toLowerCase();
        
        // Fuzzy search - match letters in order but not necessarily consecutively
        return parameters.filter(param => {
            const paramText = param.text.toLowerCase();
            let j = 0;
            for (let i = 0; i < word.length; i++) {
                const char = word[i];
                j = paramText.indexOf(char, j);
                if (j === -1) return false;
                j++;
            }
            return true;
        }).sort((a, b) => {
            // Sort by exact prefix match first, then by length
            const aText = a.text.toLowerCase();
            const bText = b.text.toLowerCase();
            const aStartsWithWord = aText.startsWith(word);
            const bStartsWithWord = bText.startsWith(word);
            
            if (aStartsWithWord && !bStartsWithWord) return -1;
            if (!aStartsWithWord && bStartsWithWord) return 1;
            
            // If both or neither starts with the word, sort by length
            return aText.length - bText.length;
        });
    }
    
    return parameters;
}
