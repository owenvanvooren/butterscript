class ButterscriptParser {
    constructor() {
        this.elementMap = {
            'heading1': 'h1', 'heading2': 'h2', 'heading3': 'h3',
            'heading4': 'h4', 'heading5': 'h5', 'heading6': 'h6',
            'paragraph': 'p', 'group': 'div', 'span': 'span',
            'list': 'ul', 'orderedlist': 'ol', 'item': 'li',
            'link': 'a', 'image': 'img', 'divider': 'hr',
            'linebreak': 'br', 'quote': 'blockquote',
            'code': 'code', 'preformatted': 'pre',
            'table': 'table', 'row': 'tr', 'cell': 'td', 'header': 'th',
            'button': 'button', 'input': 'input', 'form': 'form'
        };
        
        // Define self-closing elements that don't need brackets
        this.selfClosingElements = ['image', 'linebreak', 'divider', 'input'];
    }

    parse(input) {
        // Remove comments
        input = input.replace(/<--\([^)]*\)/g, '');

        // Handle escape sequences
        input = input.replace(/\\(.)/g, (match, char) => `__ESCAPED_${char.charCodeAt(0)}__`);

        // Process standalone snippets before splitting into lines
        input = this.processStandaloneSnippets(input);

        let html = this.parseElements(input);

        // Restore escaped characters
        html = html.replace(/__ESCAPED_(\d+)__/g, (match, code) => String.fromCharCode(parseInt(code)));

        return html;
    }

    // New method to process standalone snippets before line processing
    processStandaloneSnippets(input) {
        // First, process all standalone snippets (those that are alone on a line with optional whitespace)
        const standaloneSnippetRegex = /^(\s*)snippet\s*\[([^\]]+)\]((?:\.\w+(?:\([^)]*\))?)+)(\s*)$/gm;
        
        let processedInput = input.replace(standaloneSnippetRegex, (match, indent, content, modifiers, trailingSpace) => {
            // Process the modifiers in sequence
            let result = content;
            const modifierRegex = /\.(\w+)(?:\(([^)]*)\))?/g;
            let modMatch;
            
            while ((modMatch = modifierRegex.exec(modifiers)) !== null) {
                result = this.applyModifier(result, modMatch[1], modMatch[2]);
            }
            
            // Return the processed result with original indentation and trailing space
            return `${indent}${result}${trailingSpace}`;
        });
        
        // Now handle multiple snippets on the same line by first transforming them into one-per-line format
        // Look for snippet pattern, followed by whitespace, followed by another snippet pattern
        
        // First, split the input into lines
        const lines = processedInput.split('\n');
        const processedLines = [];
        
        for (const line of lines) {
            if (line.match(/snippet\s*\[[^\]]+\](?:(?:\.\w+(?:\([^)]*\))?)+)\s+snippet\s*\[[^\]]+\](?:(?:\.\w+(?:\([^)]*\))?)+)/)) {
                // This line has multiple snippets, so split them up
                const parts = line.match(/(\s*)(.+)/);
                if (parts) {
                    const indent = parts[1];
                    const content = parts[2];
                    
                    // Split by looking for the snippet pattern
                    const snippets = content.split(/(?<=(?:\.\w+(?:\([^)]*\))?)+)(\s+)(?=snippet\s*\[)/);
                    
                    for (let i = 0; i < snippets.length; i++) {
                        if (snippets[i].trim().startsWith('snippet')) {
                            processedLines.push(`${indent}${snippets[i]}`);
                        }
                    }
                } else {
                    processedLines.push(line); // Fallback if the regex match fails
                }
            } else {
                processedLines.push(line);
            }
        }
        
        processedInput = processedLines.join('\n');
        
        // Process any standalone snippets that were created during the line splitting
        return processedInput.replace(standaloneSnippetRegex, (match, indent, content, modifiers, trailingSpace) => {
            // Process the modifiers in sequence
            let result = content;
            const modifierRegex = /\.(\w+)(?:\(([^)]*)\))?/g;
            let modMatch;
            
            while ((modMatch = modifierRegex.exec(modifiers)) !== null) {
                result = this.applyModifier(result, modMatch[1], modMatch[2]);
            }
            
            // Return the processed result with original indentation and trailing space
            return `${indent}${result}${trailingSpace}`;
        });
    }

    // Helper method to apply a modifier to content (used by both snippet processors)
    applyModifier(content, modName, modParam) {
        // Skip modifying if content is an image tag - these are handled separately by processImageModifiers
        if (content.startsWith('<img ')) {
            return content;
        }
        
        // Handle form elements (button, input) separately
        if (content.startsWith('<button') || content.startsWith('<input')) {
            return this.applyFormElementModifier(content, modName, modParam);
        }
        
        switch (modName) {
            case 'bold':
                return `<strong>${content}</strong>`;
            case 'italic':
                return `<em>${content}</em>`;
            case 'underline':
                return `<u>${content}</u>`;
            case 'code':
                return `<code>${content}</code>`;
            case 'strikethrough':
                return `<s>${content}</s>`;
            case 'highlight':
                if (modParam) {
                    const color = modParam.startsWith('.') ? modParam.substring(1) : modParam;
                    return `<mark style="background-color: ${color}">${content}</mark>`;
                }
                return `<mark>${content}</mark>`;
            case 'font':
                if (modParam) {
                    const fontType = modParam.startsWith('.') ? modParam.substring(1) : modParam;
                    let fontFamily = '';
                    let fontClass = '';
                    switch (fontType.toLowerCase()) {
                        case 'sans':
                            fontFamily = '"IBM Plex Sans", sans-serif';
                            fontClass = 'bs-font-sans';
                            break;
                        case 'serif':
                            fontFamily = '"IBM Plex Serif", serif';
                            fontClass = 'bs-font-serif';
                            break;
                        case 'monospace':
                            fontFamily = '"IBM Plex Mono", monospace';
                            fontClass = 'bs-font-mono';
                            break;
                        default:
                            fontFamily = fontType; // Allow custom font names
                            fontClass = 'bs-font-custom';
                    }
                    return `<span style="font-family: ${fontFamily}" class="${fontClass}">${content}</span>`;
                }
                return content;
            case 'textcolor':
                if (modParam) {
                    const color = modParam.startsWith('.') ? modParam.substring(1) : modParam;
                    return `<span style="color: ${color}">${content}</span>`;
                }
                return content;
            case 'size':
                if (modParam) {
                    // Parse size parameters like "width:300px,height:200px"
                    const sizeParts = modParam.split(',');
                    const styles = [];
                    
                    sizeParts.forEach(part => {
                        const [prop, value] = part.split(':').map(p => p.trim());
                        if (prop && value) {
                            styles.push(`${prop}: ${value}`);
                        }
                    });
                    
                    if (styles.length > 0) {
                        return `<span style="${styles.join('; ')}">${content}</span>`;
                    }
                }
                return content;
            case 'fill':
                if (modParam) {
                    // Handle object-fit property for images
                    const fillMode = modParam.trim();
                    const validModes = ['cover', 'contain', 'fill', 'scale-down', 'none'];
                    
                    if (validModes.includes(fillMode)) {
                        return `<span style="object-fit: ${fillMode}; display: inline-block">${content}</span>`;
                    }
                }
                return content;
            case 'radius':
                if (modParam) {
                    // Handle border radius for images
                    return `<span style="border-radius: ${modParam}">${content}</span>`;
                }
                return content;
            default:
                return `<span class="${modName}">${content}</span>`;
        }
    }

    // New method to apply modifiers specifically for form elements
    applyFormElementModifier(content, modName, modParam) {
        // Extract current style attribute if it exists
        const styleRegex = /style="([^"]*)"/;
        let styleMatch = content.match(styleRegex);
        let currentStyle = styleMatch ? styleMatch[1] : '';
        
        // Create a new style based on the modifier
        let newStyle = '';
        
        switch (modName) {
            case 'textcolor':
                if (modParam) {
                    const color = modParam.startsWith('.') ? modParam.substring(1) : modParam;
                    newStyle = `color: ${color};`;
                }
                break;
            case 'bgcolor':
                if (modParam) {
                    const color = modParam.startsWith('.') ? modParam.substring(1) : modParam;
                    newStyle = `background-color: ${color};`;
                }
                break;
            case 'font':
                if (modParam) {
                    const fontType = modParam.startsWith('.') ? modParam.substring(1) : modParam;
                    let fontFamily = '';
                    let fontClass = '';
                    switch (fontType.toLowerCase()) {
                        case 'sans':
                            fontFamily = '"IBM Plex Sans", sans-serif';
                            fontClass = 'bs-font-sans';
                            break;
                        case 'serif':
                            fontFamily = '"IBM Plex Serif", serif';
                            fontClass = 'bs-font-serif';
                            break;
                        case 'monospace':
                            fontFamily = '"IBM Plex Mono", monospace';
                            fontClass = 'bs-font-mono';
                            break;
                        default:
                            fontFamily = fontType; // Allow custom font names
                            fontClass = 'bs-font-custom';
                    }
                    newStyle = `font-family: ${fontFamily};`;
                    
                    // Add the font class to the element
                    if (!content.includes('class="')) {
                        content = content.replace(/<(button|input)/, `<$1 class="${fontClass}"`);
                    } else {
                        content = content.replace(/class="([^"]*)"/, `class="$1 ${fontClass}"`);
                    }
                }
                break;
            case 'radius':
                if (modParam) {
                    newStyle = `border-radius: ${modParam};`;
                }
                break;
            case 'size':
                if (modParam) {
                    // Parse size parameters like "width:300px,height:200px"
                    const sizeParts = modParam.split(',');
                    
                    sizeParts.forEach(part => {
                        const [prop, value] = part.split(':').map(p => p.trim());
                        if (prop && value) {
                            newStyle += `${prop}: ${value}; `;
                        }
                    });
                }
                break;
            default:
                // For any other modifiers, add as a class
                if (!content.includes('class="')) {
                    content = content.replace(/<(button|input)/, `<$1 class="${modName}"`);
                } else {
                    content = content.replace(/class="([^"]*)"/, `class="$1 ${modName}"`);
                }
                return content;
        }
        
        // Combine with existing style or add new style attribute
        if (currentStyle) {
            content = content.replace(styleRegex, `style="${currentStyle} ${newStyle}"`);
        } else {
            content = content.replace(/<(button|input)/, `<$1 style="${newStyle}"`);
        }
        
        return content;
    }

    parseElementStart(line) {
        // Match element with inline content: element [content]
        // Updated to handle content with nested formatting elements
        const inlineRegex = /^(\w+)(?:\.([^(\[]+))?(?:\(([^)]*)\))?\s*\[(.*)\]$/;
        const inlineMatch = line.match(inlineRegex);

        if (inlineMatch) {
            const [, elementName, modifiers, params, content] = inlineMatch;
            const attributes = this.parseAttributes(modifiers, params);

            return {
                element: elementName,
                attributes,
                content: content,
                isInline: true,
                hasOpenBracket: false
            };
        }

        // Match element start with opening bracket and initial content: element [content
        const blockWithContentRegex = /^(\w+)(?:\.([^(\[]+))?(?:\(([^)]*)\))?\s*\[(.+)$/;
        const blockWithContentMatch = line.match(blockWithContentRegex);

        if (blockWithContentMatch) {
            const [, elementName, modifiers, params, initialContent] = blockWithContentMatch;
            const attributes = this.parseAttributes(modifiers, params);

            return {
                element: elementName,
                attributes,
                content: initialContent,
                isInline: false,
                hasOpenBracket: true,
                hasInitialContent: true
            };
        }

        // Match element start with opening bracket: element [
        const blockRegex = /^(\w+)(?:\.([^(\[]+))?(?:\(([^)]*)\))?\s*\[$/;
        const blockMatch = line.match(blockRegex);

        if (blockMatch) {
            const [, elementName, modifiers, params] = blockMatch;
            const attributes = this.parseAttributes(modifiers, params);

            return {
                element: elementName,
                attributes,
                content: '',
                isInline: false,
                hasOpenBracket: true,
                hasInitialContent: false
            };
        }

        // Match self-closing elements with modifiers: element.modifier1.modifier2(param)
        const selfClosingWithModifiersRegex = /^(\w+)(?:\.([^(\[]+))?(?:\(([^)]*)\))?(?:((?:\.\w+(?:\([^)]*\))?)+))?$/;
        const selfClosingWithModifiersMatch = line.match(selfClosingWithModifiersRegex);

        if (selfClosingWithModifiersMatch) {
            const [, elementName, classModifiers, params, chainedModifiers] = selfClosingWithModifiersMatch;
            const htmlTag = this.elementMap[elementName] || elementName;

            // Only treat as self-closing if it's actually a self-closing HTML element
            if (['image', 'divider', 'linebreak', 'input'].includes(elementName) ||
                ['img', 'hr', 'br', 'input'].includes(htmlTag)) {
                
                const attributes = this.parseAttributes(classModifiers, params);
                
                // Process any chained modifiers for the image
                if (chainedModifiers && elementName === 'image') {
                    this.processImageModifiers(attributes, chainedModifiers);
                }

                return {
                    element: elementName,
                    attributes,
                    content: '',
                    isInline: true,
                    hasOpenBracket: false
                };
            }
        }

        // Match self-closing elements without brackets
        const selfClosingRegex = /^(\w+)(?:\.([^(\[]+))?(?:\(([^)]*)\))?$/;
        const selfClosingMatch = line.match(selfClosingRegex);

        if (selfClosingMatch) {
            const [, elementName, modifiers, params] = selfClosingMatch;
            const htmlTag = this.elementMap[elementName] || elementName;

            // Only treat as self-closing if it's actually a self-closing HTML element
            if (['image', 'divider', 'linebreak', 'input'].includes(elementName) ||
                ['img', 'hr', 'br', 'input'].includes(htmlTag)) {
                const attributes = this.parseAttributes(modifiers, params);

                return {
                    element: elementName,
                    attributes,
                    content: '',
                    isInline: true,
                    hasOpenBracket: false
                };
            }
        }

        return null;
    }

    // New method to process image modifiers directly to the image attribute
    processImageModifiers(attributes, modifiersString) {
        if (!modifiersString) return;

        // Initialize style attribute if it doesn't exist
        if (!attributes.style) {
            attributes.style = '';
        }

        // Process each modifier in the chain
        const modifierRegex = /\.(\w+)(?:\(([^)]*)\))?/g;
        let modMatch;
        
        while ((modMatch = modifierRegex.exec(modifiersString)) !== null) {
            const modName = modMatch[1];
            const modParam = modMatch[2];
            
            switch (modName) {
                case 'size':
                    if (modParam) {
                        // Parse size parameters like "width:300px,height:200px"
                        const sizeParts = modParam.split(',');
                        
                        sizeParts.forEach(part => {
                            const [prop, value] = part.split(':').map(p => p.trim());
                            if (prop && value) {
                                attributes.style += `${prop}: ${value}; `;
                            }
                        });
                    }
                    break;
                    
                case 'fill':
                    if (modParam) {
                        const fillMode = modParam.trim();
                        const validModes = ['cover', 'contain', 'fill', 'scale-down', 'none'];
                        
                        if (validModes.includes(fillMode)) {
                            attributes.style += `object-fit: ${fillMode}; `;
                        }
                    }
                    break;
                    
                case 'radius':
                    if (modParam) {
                        attributes.style += `border-radius: ${modParam}; `;
                    }
                    break;
                
                case 'font':
                    if (modParam) {
                        const fontType = modParam.startsWith('.') ? modParam.substring(1) : modParam;
                        let fontFamily = '';
                        let fontClass = '';
                        switch (fontType.toLowerCase()) {
                            case 'sans':
                                fontFamily = '"IBM Plex Sans", sans-serif';
                                fontClass = 'bs-font-sans';
                                break;
                            case 'serif':
                                fontFamily = '"IBM Plex Serif", serif';
                                fontClass = 'bs-font-serif';
                                break;
                            case 'monospace':
                                fontFamily = '"IBM Plex Mono", monospace';
                                fontClass = 'bs-font-mono';
                                break;
                            default:
                                fontFamily = fontType; // Allow custom font names
                                fontClass = 'bs-font-custom';
                        }
                        attributes.style += `font-family: ${fontFamily}; `;
                        
                        // Add the font class
                        if (!attributes.class) {
                            attributes.class = fontClass;
                        } else {
                            attributes.class += ' ' + fontClass;
                        }
                    }
                    break;
                    
                default:
                    // For any other modifiers, add as a class
                    if (!attributes.class) {
                        attributes.class = modName;
                    } else {
                        attributes.class += ' ' + modName;
                    }
            }
        }
    }

    parseElements(input) {
        const lines = input.split('\n');
        let result = '';
        let i = 0;

        while (i < lines.length) {
            const line = lines[i].trim();

            if (line === '') {
                result += '\n';
                i++;
                continue;
            }

            if (line === ']') {
                // Skip standalone closing brackets
                i++;
                continue;
            }

            // Check for image with chained modifiers
            const imageWithModifiersRegex = /^image(?:\.([^(\[]+))?(?:\(([^)]*)\))?((?:\.\w+(?:\([^)]*\))?)+)$/;
            const imageWithModifiersMatch = line.match(imageWithModifiersRegex);
            
            if (imageWithModifiersMatch) {
                const [, classModifiers, params, chainedModifiers] = imageWithModifiersMatch;
                const attributes = this.parseAttributes(classModifiers, params);
                
                // Process the modifiers directly for the image
                this.processImageModifiers(attributes, chainedModifiers);
                
                // Create the image element
                result += this.createHTMLElement('image', attributes, '') + '\n';
                i++;
                continue;
            }

            const elementMatch = this.parseElementStart(line);
            if (elementMatch) {
                const { element, attributes, content, isInline, hasOpenBracket, hasInitialContent } = elementMatch;

                            if (isInline) {
                // Skip formatting for code elements
                if (element === 'code') {
                    result += this.createHTMLElement(element, attributes, content) + '\n';
                } else {
                    const processedContent = this.parseInlineFormatting(content);
                    result += this.createHTMLElement(element, attributes, processedContent) + '\n';
                }
                i++;
            } else if (hasOpenBracket) {
                const { endIndex, blockContent } = this.findBlockEnd(lines, i);

                let fullContent = '';
                // Skip formatting for preformatted blocks
                if (element === 'preformatted') {
                    fullContent = hasInitialContent ? (content + '\n' + blockContent) : blockContent;
                } else if (hasInitialContent) {
                    // Add the initial content from the same line, then a newline, then the block content
                    fullContent = this.parseInlineFormatting(content) + '\n' + this.parseElements(blockContent);
                } else {
                    // Just parse the block content
                    fullContent = this.parseElements(blockContent);
                }

                    result += this.createHTMLElement(element, attributes, fullContent) + '\n';
                    i = endIndex + 1;
                } else {
                    // Self-closing element or element without content
                    result += this.createHTMLElement(element, attributes, '') + '\n';
                    i++;
                }
            } else {
                // Handle plain text with inline formatting
                const processedLine = this.parseInlineFormatting(line);
                if (processedLine.trim()) {
                    result += processedLine + '\n';
                }
                i++;
            }
        }

        return result.trim();
    }

    findBlockEnd(lines, startIndex) {
        let depth = 1;
        let content = '';
        let i = startIndex + 1;

        while (i < lines.length && depth > 0) {
            const line = lines[i];
            const trimmed = line.trim();

            if (trimmed === ']') {
                depth--;
                if (depth === 0) break;
            } else {
                // Count opening brackets in the line
                const openBrackets = (line.match(/\[(?![^\]]*])/g) || []).length;
                depth += openBrackets;
            }

            if (depth > 0) {
                content += line + '\n';
            }
            i++;
        }

        return { endIndex: i, blockContent: content.trim() };
    }

    parseAttributes(modifiers, params) {
        const attributes = {};

        // Parse modifiers (CSS classes)
        if (modifiers) {
            const classes = modifiers.split('.').filter(c => c.trim());
            if (classes.length > 0) {
                attributes.class = classes.join(' ');
            }
        }

        // Parse parameters
        if (params) {
            // First check for simple parameters (for linebreak, divider)
            if (!params.includes(':')) {
                if (params.trim() === 'divider') {
                    attributes.count = params.trim();
                    return attributes;
                }
                // Handle numeric values directly for linebreak (e.g., linebreak(3))
                if (/^\s*\d+\s*$/.test(params)) {
                    attributes.count = params.trim();
                    return attributes;
                }
            }
            
            const paramRegex = /(\w+):\s*["']([^"']+)["']/g;
            let match;
            while ((match = paramRegex.exec(params)) !== null) {
                const [, key, value] = match;
                // Map butterscript attribute names to HTML
                switch (key) {
                    case 'target':
                        attributes.href = value;
                        break;
                    case 'source':
                        attributes.src = value;
                        break;
                    case 'count': // For linebreaks
                        attributes.count = value;
                        break;
                    case 'thickness': // For dividers
                        attributes.thickness = value;
                        break;
                    case 'type': // For inputs
                        attributes.type = value;
                        break;
                    case 'placeholder': // For inputs
                        attributes.placeholder = value;
                        break;
                    case 'value': // For inputs and buttons
                        attributes.value = value;
                        break;
                    case 'name': // For form elements
                        attributes.name = value;
                        break;
                    case 'required': // For form elements
                        attributes.required = value === 'true' ? 'required' : '';
                        break;
                    case 'disabled': // For form elements
                        attributes.disabled = value === 'true' ? 'disabled' : '';
                        break;
                    case 'action': // For forms
                        attributes.action = value;
                        break;
                    case 'method': // For forms
                        attributes.method = value;
                        break;
                    case 'textcolor': // Direct color styling
                        if (!attributes.style) attributes.style = '';
                        attributes.style += `color: ${value}; `;
                        break;
                    case 'bgcolor': // Direct background color styling
                        if (!attributes.style) attributes.style = '';
                        attributes.style += `background-color: ${value}; `;
                        break;
                    case 'radius': // Direct border radius styling
                        if (!attributes.style) attributes.style = '';
                        attributes.style += `border-radius: ${value}; `;
                        break;
                    // New action attributes
                    case 'onClick':
                    case 'onclick':
                        attributes.onclick = value;
                        break;
                    case 'onChange':
                    case 'onchange':
                        attributes.onchange = value;
                        break;
                    case 'onInput':
                    case 'oninput':
                        attributes.oninput = value;
                        break;
                    case 'onSubmit':
                    case 'onsubmit':
                        attributes.onsubmit = value;
                        break;
                    case 'onBlur':
                    case 'onblur':
                        attributes.onblur = value;
                        break;
                    case 'onFocus':
                    case 'onfocus':
                        attributes.onfocus = value;
                        break;
                    case 'id': // Support for element IDs
                        attributes.id = value;
                        break;
                    case 'do': // Simple action syntax
                        // Format: "action:targetId:param1:param2"
                        attributes['data-action'] = value;
                        break;
                    case 'on': // Event type for action
                        attributes['data-action-event'] = value;
                        break;
                    default:
                        attributes[key] = value;
                }
            }
        }

        return attributes;
    }

    createHTMLElement(elementName, attributes, content) {
        const htmlTag = this.elementMap[elementName] || elementName;

        // Handle self-closing tags
        if (['img', 'br', 'hr', 'input'].includes(htmlTag)) {
            const attrs = this.attributesToString(attributes);
            
            // Handle linebreak with optional count parameter
            if (elementName === 'linebreak' && attributes.count) {
                let count = parseInt(attributes.count, 10) || 1;
                count = Math.max(1, Math.min(count, 10)); // Limit between 1-10
                return '<br>'.repeat(count);
            }
            
            // Handle divider with optional thickness parameter
            if (elementName === 'divider' && attributes.thickness) {
                const thickness = attributes.thickness;
                return `<hr style="height: ${thickness}; border: none; background-color: currentColor;">`;
            }
            
            return `<${htmlTag}${attrs}>`;
        }

        // Special case for buttons with navigate/open actions - transform to anchor links for better previews
        if (elementName === 'button' && attributes['data-action']) {
            const actionParts = attributes['data-action'].split(':');
            const actionType = actionParts[0];
            const actionTarget = actionParts[1];
            
            if ((actionType === 'navigate' || actionType === 'open') && actionTarget) {
                // If URL doesn't have a protocol, add https://
                let href = actionTarget;
                if (!href.match(/^https?:\/\//i) && !href.startsWith('/')) {
                    href = 'https://' + href;
                }
                
                // Create a new attributes object for the anchor
                const anchorAttrs = { ...attributes };
                anchorAttrs.href = href;
                
                if (actionType === 'open') {
                    anchorAttrs.target = '_blank';
                    anchorAttrs.rel = 'noopener noreferrer';
                }
                
                // Keep the button styling by adding button-like classes
                if (!anchorAttrs.class) {
                    anchorAttrs.class = 'button-link';
                } else {
                    anchorAttrs.class += ' button-link';
                }
                
                const attrs = this.attributesToString(anchorAttrs);
                return `<a${attrs}>${content}</a>`;
            }
        }

        // Handle special cases
        if (elementName === 'list' || elementName === 'orderedlist') {
            const tag = elementName === 'orderedlist' ? 'ol' : 'ul';
            const processedContent = this.processListContent(content);
            const attrs = this.attributesToString(attributes);
            return `<${tag}${attrs}>${processedContent}</${tag}>`;
        }

        const attrs = this.attributesToString(attributes);
        
        // Escape HTML for code and preformatted elements
        let finalContent = content;
        if (elementName === 'code' || elementName === 'preformatted') {
            finalContent = this.escapeHtml(content);
        }

        return `<${htmlTag}${attrs}>${finalContent}</${htmlTag}>`;
    }

    processListContent(content) {
        const lines = content.split('\n').filter(line => line.trim());
        return lines.map(line => {
            const processedLine = this.parseInlineFormatting(line.trim());
            return `<li>${processedLine}</li>`;
        }).join('');
    }

    parseInlineFormatting(text) {
        if (!text) return '';

        // Process snippet tags with chained modifiers using a more precise approach
        let processedText = text;
        
        // First check for image elements with modifiers before handling other snippets
        const imageRegex = /image(?:\.([^(\[]+))?(?:\(([^)]*)\))?((?:\.\w+(?:\([^)]*\))?)+)/g;
        let imageMatch;
        
        while ((imageMatch = imageRegex.exec(text)) !== null) {
            const [fullMatch, classModifiers, params, chainedModifiers] = imageMatch;
            
            // Create attributes from parameters and class modifiers
            const attributes = this.parseAttributes(classModifiers, params);
            
            // Process the modifiers directly for the image
            this.processImageModifiers(attributes, chainedModifiers);
            
            // Create the image element
            const imageElement = this.createHTMLElement('image', attributes, '');
            
            // Replace in the processed text
            processedText = processedText.replace(fullMatch, imageElement);
        }
        
        // Process direct modifiers like .bold[text] or .italic.bold[text]
        // This matches: (whitespace or start of line)(chain of modifiers)[content]
        // Updated to handle content with potentially nested brackets
        const directModifierRegex = /(\s|^)((?:\.\w+(?:\([^)]*\))?)+)\[((?:[^\[\]]|\[(?:[^\[\]]|\[[^\[\]]*\])*\])*)\]/g;
        let directModMatch;
        
        const directModMatches = [];
        while ((directModMatch = directModifierRegex.exec(text)) !== null) {
            directModMatches.push({
                fullMatch: directModMatch[0],
                leadingWhitespace: directModMatch[1],
                modifiers: directModMatch[2],
                content: directModMatch[3]
            });
        }
        
        // Process from end to beginning to avoid position shifts
        directModMatches.sort((a, b) => {
            return text.indexOf(b.fullMatch) - text.indexOf(a.fullMatch);
        });
        
        for (const match of directModMatches) {
            // Process the modifiers in sequence
            let result = match.content;
            const modifierRegex = /\.(\w+)(?:\(([^)]*)\))?/g;
            let modMatch;
            
            while ((modMatch = modifierRegex.exec(match.modifiers)) !== null) {
                result = this.applyModifier(result, modMatch[1], modMatch[2]);
            }
            
            // Replace the original match but preserve the leading whitespace
            processedText = processedText.replace(match.fullMatch, match.leadingWhitespace + result);
        }
        
        // Then, process all snippets with modifiers
        const snippetRegex = /snippet\s*\[((?:[^\[\]]|\[(?:[^\[\]]|\[[^\[\]]*\])*\])*)\]((?:\.\w+(?:\([^)]*\))?)+)/g;
        let match;
        
        // Find all positions to avoid conflicts when replacing
        const matches = [];
        while ((match = snippetRegex.exec(text)) !== null) {
            matches.push({
                fullMatch: match[0],
                content: match[1],
                modifiers: match[2] || ''
            });
        }
        
        // Process from end to beginning to avoid position shifts
        matches.sort((a, b) => {
            return text.indexOf(b.fullMatch) - text.indexOf(a.fullMatch);
        });
        
        for (const match of matches) {
            // Process the modifiers in sequence
            let result = match.content;
            const modifierRegex = /\.(\w+)(?:\(([^)]*)\))?/g;
            let modMatch;
            
            while ((modMatch = modifierRegex.exec(match.modifiers)) !== null) {
                result = this.applyModifier(result, modMatch[1], modMatch[2]);
            }
            
            // Replace the original snippet with the processed result
            processedText = processedText.replace(match.fullMatch, result);
        }
        
        // Then process plain snippets without modifiers (after handling those with modifiers)
        processedText = processedText.replace(/snippet\s*\[((?:[^\[\]]|\[(?:[^\[\]]|\[[^\[\]]*\])*\])*)\](?!\.)/g, '$1');
        
        // Legacy bracket formatting
        processedText = processedText.replace(/\{bold\}(.*?)\{\/bold\}/g, '<strong>$1</strong>');
        processedText = processedText.replace(/\{italic\}(.*?)\{\/italic\}/g, '<em>$1</em>');
        processedText = processedText.replace(/\{underline\}(.*?)\{\/underline\}/g, '<u>$1</u>');
        processedText = processedText.replace(/\{code\}(.*?)\{\/code\}/g, '<code>$1</code>');
        
        // Line breaks
        processedText = processedText.replace(/\[br\]/g, '<br>');
        
        return processedText;
    }

    attributesToString(attributes) {
        if (!attributes || Object.keys(attributes).length === 0) return '';

        return ' ' + Object.entries(attributes)
            .map(([key, value]) => `${key}="${value}"`)
            .join(' ');
    }
    
    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
}

const parser = new ButterscriptParser();
const input = document.getElementById('butterscript-input');
const preview = document.getElementById('preview');
const lineCount = document.getElementById('line-count');

function updatePreview() {
    const butterscriptCode = input.value;
    const html = parser.parse(butterscriptCode);
    preview.innerHTML = html;

    // Update status bar
    const lines = butterscriptCode.split('\n').length;
    const chars = butterscriptCode.length;
    lineCount.textContent = `Lines: ${lines} • Characters: ${chars}`;
}

function formatCode() {
    const code = input.value;
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

    input.value = formatted.trim();
    updatePreview();
    showToast('Code formatted!');
}

function copyCode() {
    navigator.clipboard.writeText(input.value);
    showToast('butterscript code copied!');
}

function copyButterscript() {
    navigator.clipboard.writeText(input.value);
    showToast('butterscript code copied!');
}

function copyHTML() {
    const html = parser.parse(input.value);
    navigator.clipboard.writeText(html);
    showToast('HTML copied!');
}

function downloadHTML() {
    const html = parser.parse(input.value);
    const fullHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>butterscript Document</title>
    <style>
        body { font-family: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 2rem; color: #333; }
        h1, h2, h3, h4, h5, h6 { margin: 1.2em 0 0.6em 0; font-weight: 600; }
        p { margin: 0.8em 0; }
        ul, ol { padding-left: 2em; margin: 0.8em 0; }
        li { margin: 0.3em 0; }
        blockquote { border-left: 4px solid #F5E985; padding-left: 1em; margin: 1em 0; color: #666; font-style: italic; }
        code { background: #f6f8fa; padding: 2px 6px; border-radius: 3px; font-family: 'IBM Plex Mono', 'Consolas', 'Monaco', 'Courier New', monospace; }
        pre { background: #f6f8fa; padding: 16px; border-radius: 6px; overflow-x: auto; border: 1px solid #e1e4e8; }
        a { color: #8B7B22; text-decoration: none; }
        a:hover { text-decoration: underline; }
        img { max-width: 100%; height: auto; border-radius: 4px; }
        hr { border: none; border-top: 1px solid #F5E985; margin: 2em 0; }
        
        /* Button styles */
        button, .button-link {
            background-color: #F5E985;
            color: #1d1d1f;
            border: none;
            padding: 8px 16px;
            border-radius: 6px;
            font-family: 'IBM Plex Sans', -apple-system, sans-serif;
            font-weight: 500;
            font-size: 16px;
            cursor: pointer;
            transition: background-color 0.2s, transform 0.1s;
            text-decoration: none;
            display: inline-block;
        }
        
        button:hover, .button-link:hover {
            background-color: #f0e270;
            transform: translateY(-1px);
        }
        
        button:active, .button-link:active {
            transform: translateY(1px);
        }
        
        /* Form styles */
        input[type="text"], input[type="email"], input[type="password"], input[type="number"], input[type="search"] {
            border: 1px solid #d1d1d6;
            border-radius: 6px;
            padding: 8px 12px;
            font-family: 'IBM Plex Sans', -apple-system, sans-serif;
            font-size: 16px;
            margin-bottom: 16px;
            width: 100%;
            max-width: 300px;
        }
        
        /* Spacing for form elements */
        form {
            margin: 1.5em 0;
            display: flex;
            flex-direction: column;
            gap: 16px;
            max-width: 500px;
        }
        
        /* Button group styling */
        div:has(button), div:has(.button-link) {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-top: 16px;
            margin-bottom: 16px;
        }
        
        /* Support for the butterscript highlight class */
        .highlight-text {
            background-color: #ffffc8;
            border-left: 4px solid #F5E985;
            padding: 8px 16px;
            border-radius: 4px;
            animation: pulse 1s ease;
        }
        
        @keyframes pulse {
            0% { background-color: #F5E985; }
            100% { background-color: #ffffc8; }
        }
    </style>
    <script>
        // Simple action handler for exported documents
        document.addEventListener('DOMContentLoaded', function() {
            // Handle data-action attributes
            document.querySelectorAll('[data-action]').forEach(function(element) {
                const actionData = element.getAttribute('data-action');
                const [action, target, ...params] = actionData.split(':');
                const eventType = element.getAttribute('data-action-event') || 'click';
                
                element.addEventListener(eventType, function(event) {
                    event.preventDefault();
                    
                    switch(action) {
                        case 'toggle':
                            const targetElement = document.getElementById(target);
                            if (targetElement) {
                                targetElement.style.display = targetElement.style.display === 'none' ? '' : 'none';
                            }
                            break;
                        case 'show':
                            document.getElementById(target)?.style.setProperty('display', '');
                            break;
                        case 'hide':
                            document.getElementById(target)?.style.setProperty('display', 'none');
                            break;
                        case 'alert':
                            alert(target || 'Alert');
                            break;
                        case 'toggleClass':
                            document.getElementById(target)?.classList.toggle(params[0] || '');
                            break;
                    }
                });
            });
        });
    </script>
</head>
<body>
${html}
</body>
</html>`;

    const blob = new Blob([fullHTML], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'butterscript-document.html';
    a.click();
    URL.revokeObjectURL(url);
    showToast('HTML file downloaded!');
}

function downloadButterscript() {
    const butterscriptCode = input.value;
    const blob = new Blob([butterscriptCode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'document.butterscript';
    a.click();
    URL.revokeObjectURL(url);
    showToast('butterscript file downloaded!');
}

function toggleExportDropdown() {
    const dropdown = document.getElementById('export-dropdown');
    dropdown.classList.toggle('show');
    
    // Close dropdown when clicking outside
    document.addEventListener('click', function closeDropdown(e) {
        if (!e.target.matches('.export-btn') && 
            !e.target.closest('#export-dropdown') && 
            !e.target.closest('.material-icons')) {
            dropdown.classList.remove('show');
            document.removeEventListener('click', closeDropdown);
        }
    });
}

function loadExample() {
    const example = `<--(Welcome to butterscript - elegant text formatting)

heading1 [Butterscript]

paragraph [
Butterscript is a natural markup language that blends human-readable syntax with powerful formatting capabilities. It offers the .bold[simplicity] of Markdown with the .italic[expressiveness] of HTML.
]

heading2 [Core Syntax]

paragraph [
Butterscript uses a clean, intuitive structure with element names followed by content in brackets:
]

preformatted [
element [Your content here]
element.modifier [Content with modifier]
element(param: "value") [Content with parameter]
]

heading2 [Text Formatting]

paragraph [
Butterscript provides multiple ways to format text:
]

list [
snippet[Snippets].bold with chainable modifiers 
Direct .bold.italic[inline formatting] using dot syntax
Flexible .textcolor(#e83e8c)[color] and .highlight(.yellow)[highlighting] options
Layered .bold.italic.underline[formatting combinations]
]

heading3 [Modifier Examples]

paragraph [
Here are the core text modifiers:
]

group [
  paragraph [.bold[Bold text] for emphasis]
  paragraph [.italic[Italic text] for subtle emphasis]
  paragraph [.underline[Underlined text] for important items]
  paragraph [.code[console.log("Hello");] for inline code]
  paragraph [.strikethrough[Strikethrough] for deleted content]
  paragraph [.highlight[Highlighted text] for key points]
]

heading3 [Font Options]

paragraph [
Choose from different font families:
]

group [
  paragraph [.font(.sans)[IBM Plex Sans] for clean, modern text]
  paragraph [.font(.serif)[IBM Plex Serif] for traditional, readable content]
  paragraph [.font(.monospace)[IBM Plex Mono] for code and technical content]
  paragraph [Try .bold.font(.serif)[combining fonts] with other modifiers]
]

heading3 [Color Options]

paragraph [
You can use .textcolor(.blue)[named colors], .textcolor(#ff5722)[hex values], or .highlight(.lightgreen)[custom highlights].
]

divider

heading2 [Structural Elements]

heading3 [Links & Images]

paragraph [
Create links easily:
]

link(target: "https://github.com") [Visit GitHub]

paragraph [
Format and resize images:
]

image(source: "butterscript-assets/sample.png", alt: "Sample image").size(width:300px,height:auto).radius(8px)

heading3 [Quotes & Lists]

quote [
"Simplicity is the ultimate sophistication." — Leonardo da Vinci
]

paragraph [
Different list types:
]

list [
Unordered list item one
Item two with .italic[formatting]
Item three
]

orderedlist [
First ordered item
Second ordered item with .bold[emphasis]
Third item
]

heading2 [Interactive Elements]

paragraph [
Butterscript enables interactive content through simple actions:
]

group [
  button(do: "alert:Hello from Butterscript!", bgcolor: "#F5E985", textcolor: "#1c1c1e", radius: "8px") [Show Alert]
  button(do: "navigate:github.com", bgcolor: "#1c1c1e", textcolor: "#F5E985", radius: "8px") [Open GitHub]
]

heading3 [Togglable Content]

button(do: "toggle:hidden-example", bgcolor: "#F5E985", textcolor: "#1c1c1e", radius: "8px") [Toggle Content]

group(id: "hidden-example", style: "display: none;") [
  paragraph [
    This content is initially hidden but can be toggled.
    Perfect for FAQs, accordions, and interactive documentation.
  ]
  
  image(source: "butterscript-assets/butterscript-logo.svg", alt: "Butterscript Logo").size(width:200px,height:auto)
]

divider

heading2 [Advanced Features]

paragraph [
Butterscript also supports:
]

list [
.bold[Direct modifiers] like .highlight(.pink)[this example]
.italic[Custom styling] through .textcolor(#9C27B0)[color] attributes
.code[Multi-line content] with proper formatting
.bold.italic[Layered] formatting .highlight(.lightblue)[combinations]
]

divider(thickness: "2px")

paragraph [
Butterscript combines the best of markdown and rich text editing in a simple, elegant syntax.
]`;

    input.value = example;
    updatePreview();
    showToast('Example loaded!');
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideOut 0.2s ease';
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 200);
    }, 2000);
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
            case 's':
                e.preventDefault();
                toggleExportDropdown();
                break;
            case 'e':
                e.preventDefault();
                loadExample();
                break;
        }

        if (e.shiftKey) {
            switch (e.key) {
                case 'F':
                    e.preventDefault();
                    formatCode();
                    break;
                case 'C':
                    e.preventDefault();
                    copyHTML();
                    break;
                case 'B':
                    e.preventDefault();
                    copyButterscript();
                    break;
            }
        }
    }
});

// Initialize
input.addEventListener('input', updatePreview);
loadExample();
updatePreview();

// Initialize the autocomplete
let autocomplete;
document.addEventListener('DOMContentLoaded', () => {
    autocomplete = new ButterscriptAutocomplete(input, parser);
    
    // Manually trigger the input event to show suggestions if the editor already has content
    if (input.value) {
        input.dispatchEvent(new Event('input'));
    }
});

// Show a toast about the new autocomplete feature
setTimeout(() => {
    showToast('New! Intelligent autocomplete is now available. Start typing to see suggestions.');
}, 1000);

// For debugging - allow to toggle autocomplete visibility with Ctrl+Space
input.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.code === 'Space') {
        e.preventDefault();
        const autocompleteContainer = document.getElementById('autocomplete-container');
        if (autocompleteContainer.style.display === 'block') {
            autocompleteContainer.style.display = 'none';
        } else {
            autocompleteContainer.style.display = 'block';
            // Manually trigger input event to refresh suggestions
            input.dispatchEvent(new Event('input'));
        }
    }
});

// Find and Replace Functionality
const findReplacePanel = document.getElementById('find-replace-panel');
const findInput = document.getElementById('find-input');
const replaceInput = document.getElementById('replace-input');
const matchCount = document.getElementById('match-count');
const prevMatchBtn = document.getElementById('prev-match');
const nextMatchBtn = document.getElementById('next-match');
const replaceBtn = document.getElementById('replace-btn');
const replaceAllBtn = document.getElementById('replace-all-btn');
const closeFind = document.getElementById('close-find');

let matches = [];
let currentMatchIndex = -1;

// Open find panel with keyboard shortcut
function toggleFindPanel() {
    const isHidden = findReplacePanel.style.display === 'none' || !findReplacePanel.style.display;
    findReplacePanel.style.display = isHidden ? 'flex' : 'none';
    
    if (isHidden) {
        findInput.focus();
        // Check if there's selected text in the editor
        const selectedText = getSelectedText();
        if (selectedText) {
            findInput.value = selectedText;
            findInText();
        }
    } else {
        clearMatches();
        input.focus();
    }
}

// Get selected text from textarea
function getSelectedText() {
    return input.value.substring(input.selectionStart, input.selectionEnd);
}

// Find all occurrences of the search term
function findInText() {
    const searchTerm = findInput.value;
    const text = input.value;
    
    // Clear previous matches
    clearMatches();
    
    if (!searchTerm) {
        updateMatchCount();
        return;
    }
    
    // Find all occurrences
    let index = -1;
    while ((index = text.indexOf(searchTerm, index + 1)) !== -1) {
        matches.push({
            start: index,
            end: index + searchTerm.length
        });
    }
    
    updateMatchCount();
    
    // Select first match if any
    if (matches.length > 0) {
        selectMatch(0);
    }
}

// Clear all matches
function clearMatches() {
    matches = [];
    currentMatchIndex = -1;
    updateMatchCount();
}

// Update the match counter display
function updateMatchCount() {
    if (matches.length === 0) {
        matchCount.textContent = '0/0';
    } else {
        matchCount.textContent = `${currentMatchIndex + 1}/${matches.length}`;
    }
}

// Select and highlight a specific match
function selectMatch(index) {
    if (index < 0 || index >= matches.length) return;
    
    currentMatchIndex = index;
    const match = matches[index];
    
    // Select the text in the textarea
    input.focus();
    input.setSelectionRange(match.start, match.end);
    
    // Ensure the selected text is visible
    scrollToSelection();
    
    updateMatchCount();
}

// Scroll the textarea to show the current selection
function scrollToSelection() {
    const textBeforeSelection = input.value.substring(0, input.selectionStart);
    const lineHeight = 20; // Approximate line height in pixels
    const linesBefore = (textBeforeSelection.match(/\n/g) || []).length;
    const approximateTop = linesBefore * lineHeight;
    
    input.scrollTop = approximateTop - (input.clientHeight / 2);
}

// Navigate to the next match
function nextMatch() {
    if (matches.length === 0) return;
    
    const nextIndex = currentMatchIndex + 1 >= matches.length ? 0 : currentMatchIndex + 1;
    selectMatch(nextIndex);
}

// Navigate to the previous match
function prevMatch() {
    if (matches.length === 0) return;
    
    const prevIndex = currentMatchIndex - 1 < 0 ? matches.length - 1 : currentMatchIndex - 1;
    selectMatch(prevIndex);
}

// Replace the current match
function replaceMatch() {
    if (matches.length === 0 || currentMatchIndex === -1) return;
    
    const match = matches[currentMatchIndex];
    const replaceText = replaceInput.value;
    const before = input.value.substring(0, match.start);
    const after = input.value.substring(match.end);
    
    input.value = before + replaceText + after;
    
    // Update all matches as the text has changed
    const cursorPosition = match.start + replaceText.length;
    input.setSelectionRange(cursorPosition, cursorPosition);
    
    // Refresh the matches
    findInText();
    
    // Update the preview
    updatePreview();
}

// Replace all matches
function replaceAllMatches() {
    const searchTerm = findInput.value;
    const replaceText = replaceInput.value;
    
    if (!searchTerm || matches.length === 0) return;
    
    const newText = input.value.split(searchTerm).join(replaceText);
    input.value = newText;
    
    // Show count of replacements
    showToast(`${matches.length} occurrences replaced`);
    
    // Clear matches and refresh
    clearMatches();
    findInText();
    
    // Update the preview
    updatePreview();
}

// Event Listeners
findInput.addEventListener('input', findInText);
prevMatchBtn.addEventListener('click', prevMatch);
nextMatchBtn.addEventListener('click', nextMatch);
replaceBtn.addEventListener('click', replaceMatch);
replaceAllBtn.addEventListener('click', replaceAllMatches);
closeFind.addEventListener('click', toggleFindPanel);

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
    // CMD+F / CTRL+F to open find panel
    if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        toggleFindPanel();
    }
    
    // F3 for next match
    if (e.key === 'F3' || (e.ctrlKey && e.key === 'g')) {
        e.preventDefault();
        nextMatch();
    }
    
    // Shift+F3 for previous match
    if (e.shiftKey && e.key === 'F3' || (e.ctrlKey && e.shiftKey && e.key === 'g')) {
        e.preventDefault();
        prevMatch();
    }
    
    // ESC to close find panel
    if (e.key === 'Escape' && findReplacePanel.style.display === 'flex') {
        e.preventDefault();
        toggleFindPanel();
    }
    
    // CMD+E / CTRL+E for Example
    if ((e.metaKey || e.ctrlKey) && e.key === 'e') {
        e.preventDefault();
        loadExample();
    }
    
    // CMD+SHIFT+B / CTRL+SHIFT+B for Copy butterscript
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'b') {
        e.preventDefault();
        copyButterscript();
    }
    
    // CMD+SHIFT+C / CTRL+SHIFT+C for Copy HTML
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'c') {
        e.preventDefault();
        copyHTML();
    }
    
    // CMD+S / CTRL+S for Export
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        toggleExportDropdown();
    }
});

// Initialize
input.addEventListener('input', updatePreview);
updatePreview();

// Initialize editor
input.addEventListener('keydown', function(e) {
    // Handle tabs for indentation
    if (e.key === 'Tab') {
        e.preventDefault();
        const start = this.selectionStart;
        const end = this.selectionEnd;
        
        this.value = this.value.substring(0, start) + '  ' + this.value.substring(end);
        this.selectionStart = this.selectionEnd = start + 2;
    }
});

// Autocomplete functionality
class ButterscriptAutocomplete {
    constructor(editor, parser) {
        this.editor = editor;
        this.parser = parser;
        this.container = document.getElementById('autocomplete-container');
        this.list = this.container.querySelector('.autocomplete-list');
        this.isVisible = false;
        this.currentSuggestions = [];
        this.selectedIndex = -1;
        this.userHasNavigated = false; // Track if user has used arrow keys
        this.triggerCharacters = ['', ' ', '\n'];
        this.currentWordStart = 0; // Track the start position of the current word
        this.currentWord = ''; // Track the current word being typed
        
        // Define suggestion categories
        this.suggestions = {
            elements: [
                { 
                    text: 'heading1', 
                    displayText: 'heading1', 
                    type: 'element', 
                    icon: 'format_1', 
                    description: 'Level 1 heading (h1)', 
                    snippet: 'heading1 [Title]' 
                },
                { 
                    text: 'heading2', 
                    displayText: 'heading2', 
                    type: 'element', 
                    icon: 'format_2', 
                    description: 'Level 2 heading (h2)',
                    snippet: 'heading2 [Subtitle]' 
                },
                { 
                    text: 'heading3', 
                    displayText: 'heading3', 
                    type: 'element', 
                    icon: 'format_3', 
                    description: 'Level 3 heading (h3)',
                    snippet: 'heading3 [Section]' 
                },
                { 
                    text: 'heading4', 
                    displayText: 'heading4', 
                    type: 'element', 
                    icon: 'format_4', 
                    description: 'Level 4 heading (h4)',
                    snippet: 'heading4 [Subsection]' 
                },
                { 
                    text: 'heading5', 
                    displayText: 'heading5', 
                    type: 'element', 
                    icon: 'format_5', 
                    description: 'Level 5 heading (h5)',
                    snippet: 'heading5 [Minor heading]' 
                },
                { 
                    text: 'heading6', 
                    displayText: 'heading6', 
                    type: 'element', 
                    icon: 'format_6', 
                    description: 'Level 6 heading (h6)',
                    snippet: 'heading6 [Small heading]' 
                },
                { 
                    text: 'paragraph', 
                    displayText: 'paragraph', 
                    type: 'element', 
                    icon: 'notes', 
                    description: 'Paragraph of text (p)', 
                    snippet: 'paragraph [Text content]' 
                },
                { 
                    text: 'group', 
                    displayText: 'group', 
                    type: 'element', 
                    icon: 'folder', 
                    description: 'Group container (div)', 
                    snippet: 'group [\n  \n]',
                    cursorOffset: -2
                },
                { 
                    text: 'span', 
                    displayText: 'span', 
                    type: 'element', 
                    icon: 'text_fields', 
                    description: 'Inline text container (span)', 
                    snippet: 'span [Text]' 
                },
                { 
                    text: 'list', 
                    displayText: 'list', 
                    type: 'element', 
                    icon: 'format_list_bulleted', 
                    description: 'Unordered list (ul)', 
                    snippet: 'list [\n  First item\n  Second item\n  Third item\n]',
                    cursorOffset: -23
                },
                { 
                    text: 'orderedlist', 
                    displayText: 'orderedlist', 
                    type: 'element', 
                    icon: 'format_list_numbered', 
                    description: 'Ordered list (ol)', 
                    snippet: 'orderedlist [\n  First item\n  Second item\n  Third item\n]',
                    cursorOffset: -23
                },
                { 
                    text: 'item', 
                    displayText: 'item', 
                    type: 'element', 
                    icon: 'label', 
                    description: 'List item (li)', 
                    snippet: 'item [Item content]' 
                },
                { 
                    text: 'link', 
                    displayText: 'link', 
                    type: 'element', 
                    icon: 'link', 
                    description: 'Hyperlink (a)', 
                    snippet: 'link(target: "https://example.com") [Link text]',
                    cursorOffset: -28
                },
                { 
                    text: 'image', 
                    displayText: 'image', 
                    type: 'element', 
                    icon: 'image', 
                    description: 'Image (img)', 
                    snippet: 'image(source: "image.jpg", alt: "Image description")',
                    cursorOffset: -26
                },
                { 
                    text: 'divider', 
                    displayText: 'divider', 
                    type: 'element', 
                    icon: 'horizontal_rule', 
                    description: 'Horizontal divider (hr)', 
                    snippet: 'divider'
                },
                { 
                    text: 'divider with thickness', 
                    displayText: 'divider(thickness)', 
                    type: 'element', 
                    icon: 'horizontal_rule', 
                    description: 'Horizontal divider with custom thickness', 
                    snippet: 'divider(thickness: "2px")',
                    cursorOffset: -2
                },
                { 
                    text: 'linebreak', 
                    displayText: 'linebreak', 
                    type: 'element', 
                    icon: 'keyboard_return', 
                    description: 'Line break (br)', 
                    snippet: 'linebreak'
                },
                { 
                    text: 'linebreak multiple', 
                    displayText: 'linebreak(count)', 
                    type: 'element', 
                    icon: 'keyboard_return', 
                    description: 'Multiple line breaks', 
                    snippet: 'linebreak(count: "2")',
                    cursorOffset: -2
                },
                { 
                    text: 'linebreak numeric', 
                    displayText: 'linebreak(3)', 
                    type: 'element', 
                    icon: 'keyboard_return', 
                    description: 'Three line breaks', 
                    snippet: 'linebreak(3)',
                    cursorOffset: -1
                },
                { 
                    text: 'quote', 
                    displayText: 'quote', 
                    type: 'element', 
                    icon: 'format_quote', 
                    description: 'Block quotation (blockquote)', 
                    snippet: 'quote [Quoted text]' 
                },
                { 
                    text: 'code', 
                    displayText: 'code', 
                    type: 'element', 
                    icon: 'code', 
                    description: 'Code snippet (code)', 
                    snippet: 'code [Code snippet]' 
                },
                { 
                    text: 'preformatted', 
                    displayText: 'preformatted', 
                    type: 'element', 
                    icon: 'code', 
                    description: 'Preformatted text (pre)', 
                    snippet: 'preformatted [\nfunction example() {\n  console.log("Hello world");\n}\n]',
                    cursorOffset: -4
                },
                { 
                    text: 'table', 
                    displayText: 'table', 
                    type: 'element', 
                    icon: 'table_chart', 
                    description: 'Table (table)', 
                    snippet: 'table [\n  row [\n    header [Column 1]\n    header [Column 2]\n  ]\n  row [\n    cell [Data 1]\n    cell [Data 2]\n  ]\n]',
                    cursorOffset: -4
                },
                { 
                    text: 'row', 
                    displayText: 'row', 
                    type: 'element', 
                    icon: 'view_week', 
                    description: 'Table row (tr)', 
                    snippet: 'row [\n  cell [Data]\n  cell [Data]\n]',
                    cursorOffset: -4
                },
                { 
                    text: 'cell', 
                    displayText: 'cell', 
                    type: 'element', 
                    icon: 'crop_square', 
                    description: 'Table cell (td)', 
                    snippet: 'cell [Cell content]' 
                },
                { 
                    text: 'header', 
                    displayText: 'header', 
                    type: 'element', 
                    icon: 'view_column', 
                    description: 'Table header (th)', 
                    snippet: 'header [Header content]' 
                },
                { 
                    text: 'button', 
                    displayText: 'button', 
                    type: 'element', 
                    icon: 'smart_button', 
                    description: 'Button (button)', 
                    snippet: 'button [Button text]' 
                },
                { 
                    text: 'button with styles', 
                    displayText: 'button(with styles)', 
                    type: 'element', 
                    icon: 'smart_button', 
                    description: 'Button with custom styling', 
                    snippet: 'button(textcolor: "#ffffff", bgcolor: "#4CAF50", radius: "8px") [Button text]',
                    cursorOffset: -13
                },
                { 
                    text: 'input', 
                    displayText: 'input', 
                    type: 'element', 
                    icon: 'input', 
                    description: 'Input field (input)', 
                    snippet: 'input(type: "text", placeholder: "Enter text")',
                    cursorOffset: -1
                },
                { 
                    text: 'input with styles', 
                    displayText: 'input(with styles)', 
                    type: 'element', 
                    icon: 'input', 
                    description: 'Input field with custom styling', 
                    snippet: 'input(type: "text", placeholder: "Enter text", radius: "8px", textcolor: "#333333")',
                    cursorOffset: -1
                },
                { 
                    text: 'form', 
                    displayText: 'form', 
                    type: 'element', 
                    icon: 'list_alt_check', 
                    description: 'Form (form)', 
                    snippet: 'form(action: "/submit") [\n  \n]',
                    cursorOffset: -2
                }
            ],
            modifiers: [
                { text: 'bold', displayText: '.bold', type: 'modifier', icon: 'format_bold', description: 'Make text bold' },
                { text: 'italic', displayText: '.italic', type: 'modifier', icon: 'format_italic', description: 'Make text italic' },
                { text: 'underline', displayText: '.underline', type: 'modifier', icon: 'format_underlined', description: 'Underline text' },
                { text: 'code', displayText: '.code', type: 'modifier', icon: 'code', description: 'Format as code' },
                { text: 'strikethrough', displayText: '.strikethrough', type: 'modifier', icon: 'strikethrough_s', description: 'Strikethrough text' },
                { text: 'highlight', displayText: '.highlight', type: 'modifier', icon: 'format_ink_highlighter', description: 'Highlight text', insertText: '.highlight' },
                { text: 'highlight with color', displayText: '.highlight(...)', type: 'modifier', icon: 'format_paint', description: 'Highlight with custom color', insertText: '.highlight(.yellow)' },
                { text: 'textcolor', displayText: '.textcolor(...)', type: 'modifier', icon: 'palette', description: 'Change text color', insertText: '.textcolor(.blue)' },
                { text: 'bgcolor', displayText: '.bgcolor(...)', type: 'modifier', icon: 'format_color_fill', description: 'Change background color', insertText: '.bgcolor(.green)' },
                { text: 'size', displayText: '.size(...)', type: 'modifier', icon: 'photo_size_select_large', description: 'Set width/height for images', insertText: '.size(width:300px,height:auto)' },
                { text: 'fill', displayText: '.fill(...)', type: 'modifier', icon: 'fit_screen', description: 'Set how image fills its container', insertText: '.fill(cover)' },
                { text: 'radius', displayText: '.radius(...)', type: 'modifier', icon: 'rounded_corner', description: 'Set border radius', insertText: '.radius(8px)' },
                { text: 'font', displayText: '.font(...)', type: 'modifier', icon: 'font_download', description: 'Change font family', insertText: '.font(.sans)' },
                { text: 'font sans', displayText: '.font(.sans)', type: 'modifier', icon: 'font_download', description: 'Use IBM Plex Sans font', insertText: '.font(.sans)' },
                { text: 'font serif', displayText: '.font(.serif)', type: 'modifier', icon: 'font_download', description: 'Use IBM Plex Serif font', insertText: '.font(.serif)' },
                { text: 'font monospace', displayText: '.font(.monospace)', type: 'modifier', icon: 'code', description: 'Use IBM Plex Mono font', insertText: '.font(.monospace)' }
            ],
            snippets: [
                { text: 'snippet', displayText: 'snippet[...]', type: 'snippet', icon: 'label', description: 'Create a formatted snippet', snippet: 'snippet[]', cursorOffset: -1 },
                { text: 'snippet with bold', displayText: 'snippet[...].bold', type: 'snippet', icon: 'label_important', description: 'Bold snippet', snippet: 'snippet[].bold', cursorOffset: -6 },
                { text: 'snippet with italic', displayText: 'snippet[...].italic', type: 'snippet', icon: 'label_important', description: 'Italic snippet', snippet: 'snippet[].italic', cursorOffset: -8 }
            ],
            parameters: [
                { text: 'target', displayText: 'target: "..."', type: 'param', icon: 'link', description: 'Link target URL', snippet: 'target: ""', cursorOffset: -1 },
                { text: 'source', displayText: 'source: "..."', type: 'param', icon: 'image', description: 'Image source URL', snippet: 'source: ""', cursorOffset: -1 },
                { text: 'alt', displayText: 'alt: "..."', type: 'param', icon: 'description', description: 'Alternative text', snippet: 'alt: ""', cursorOffset: -1 },
                { text: 'thickness', displayText: 'thickness: "..."', type: 'param', icon: 'height', description: 'Element thickness (CSS size)', snippet: 'thickness: "2px"', cursorOffset: -3 },
                { text: 'count', displayText: 'count: "..."', type: 'param', icon: 'repeat', description: 'Number of repetitions', snippet: 'count: "2"', cursorOffset: -2 },
                { text: 'width', displayText: 'width: "..."', type: 'param', icon: 'width', description: 'Width in CSS units', snippet: 'width: "300px"', cursorOffset: -3 },
                { text: 'height', displayText: 'height: "..."', type: 'param', icon: 'height', description: 'Height in CSS units', snippet: 'height: "200px"', cursorOffset: -3 },
                { text: 'type', displayText: 'type: "..."', type: 'param', icon: 'category', description: 'Input type (text, email, password, etc)', snippet: 'type: "text"', cursorOffset: -1 },
                { text: 'placeholder', displayText: 'placeholder: "..."', type: 'param', icon: 'format_color_text', description: 'Input placeholder text', snippet: 'placeholder: ""', cursorOffset: -1 },
                { text: 'value', displayText: 'value: "..."', type: 'param', icon: 'edit', description: 'Default value for input/button', snippet: 'value: ""', cursorOffset: -1 },
                { text: 'name', displayText: 'name: "..."', type: 'param', icon: 'label', description: 'Form element name', snippet: 'name: ""', cursorOffset: -1 },
                { text: 'required', displayText: 'required: "..."', type: 'param', icon: 'priority_high', description: 'Required form field', snippet: 'required: "true"', cursorOffset: -1 },
                { text: 'disabled', displayText: 'disabled: "..."', type: 'param', icon: 'block', description: 'Disabled form element', snippet: 'disabled: "true"', cursorOffset: -1 },
                { text: 'action', displayText: 'action: "..."', type: 'param', icon: 'sync', description: 'Form submission URL', snippet: 'action: "/submit"', cursorOffset: -1 },
                { text: 'method', displayText: 'method: "..."', type: 'param', icon: 'call_made', description: 'Form HTTP method (GET/POST)', snippet: 'method: "post"', cursorOffset: -1 },
                { text: 'textcolor', displayText: 'textcolor: "..."', type: 'param', icon: 'palette', description: 'Text color value', snippet: 'textcolor: "#333333"', cursorOffset: -1 },
                { text: 'bgcolor', displayText: 'bgcolor: "..."', type: 'param', icon: 'format_color_fill', description: 'Background color value', snippet: 'bgcolor: "#f1f1f1"', cursorOffset: -1 },
                { text: 'radius', displayText: 'radius: "..."', type: 'param', icon: 'rounded_corner', description: 'Border radius value', snippet: 'radius: "8px"', cursorOffset: -3 },
                { text: 'id', displayText: 'id: "..."', type: 'param', icon: 'tag', description: 'Element ID for targeting', snippet: 'id: "my-element"', cursorOffset: -1 },
                { text: 'onclick', displayText: 'onclick: "..."', type: 'param', icon: 'touch_app', description: 'JavaScript onClick handler', snippet: 'onclick: "alert(\'Clicked!\')"', cursorOffset: -1 },
                { text: 'onchange', displayText: 'onchange: "..."', type: 'param', icon: 'compare_arrows', description: 'JavaScript onChange handler', snippet: 'onchange: "handleChange(this)"', cursorOffset: -1 },
                { text: 'onsubmit', displayText: 'onsubmit: "..."', type: 'param', icon: 'send', description: 'JavaScript onSubmit handler', snippet: 'onsubmit: "return validateForm()"', cursorOffset: -1 },
                { text: 'do', displayText: 'do: "..."', type: 'param', icon: 'play_arrow', description: 'Action to perform', snippet: 'do: "action:targetId"', cursorOffset: -1 },
                { text: 'do:toggle', displayText: 'do: "toggle:..."', type: 'param', icon: 'visibility', description: 'Toggle element visibility', snippet: 'do: "toggle:elementId"', cursorOffset: -1 },
                { text: 'do:show', displayText: 'do: "show:..."', type: 'param', icon: 'visibility', description: 'Show an element', snippet: 'do: "show:elementId"', cursorOffset: -1 },
                { text: 'do:hide', displayText: 'do: "hide:..."', type: 'param', icon: 'visibility_off', description: 'Hide an element', snippet: 'do: "hide:elementId"', cursorOffset: -1 },
                { text: 'do:submit', displayText: 'do: "submit:..."', type: 'param', icon: 'send', description: 'Submit a form', snippet: 'do: "submit:formId"', cursorOffset: -1 },
                { text: 'do:reset', displayText: 'do: "reset:..."', type: 'param', icon: 'restart_alt', description: 'Reset a form', snippet: 'do: "reset:formId"', cursorOffset: -1 },
                { text: 'do:navigate', displayText: 'do: "navigate:..."', type: 'param', icon: 'link', description: 'Navigate to URL', snippet: 'do: "navigate:https://example.com"', cursorOffset: -1 },
                { text: 'do:open', displayText: 'do: "open:..."', type: 'param', icon: 'open_in_new', description: 'Open URL in new tab', snippet: 'do: "open:https://example.com"', cursorOffset: -1 },
                { text: 'do:copy', displayText: 'do: "copy:..."', type: 'param', icon: 'content_copy', description: 'Copy text to clipboard', snippet: 'do: "copy:Text to copy"', cursorOffset: -1 },
                { text: 'do:alert', displayText: 'do: "alert:..."', type: 'param', icon: 'announcement', description: 'Show an alert', snippet: 'do: "alert:This is an alert message"', cursorOffset: -1 },
                { text: 'do:confirm', displayText: 'do: "confirm:..."', type: 'param', icon: 'help', description: 'Show confirmation dialog', snippet: 'do: "confirm:Are you sure?"', cursorOffset: -1 },
                { text: 'do:toggleClass', displayText: 'do: "toggleClass:..."', type: 'param', icon: 'style', description: 'Toggle a CSS class', snippet: 'do: "toggleClass:elementId:className"', cursorOffset: -1 },
                { text: 'do:exportHTML', displayText: 'do: "exportHTML"', type: 'param', icon: 'html', description: 'Export as HTML file', snippet: 'do: "exportHTML"', cursorOffset: -1 },
                { text: 'do:exportButterscript', displayText: 'do: "exportButterscript"', type: 'param', icon: 'code', description: 'Export as butterscript file', snippet: 'do: "exportButterscript"', cursorOffset: -1 },
                { text: 'on', displayText: 'on: "..."', type: 'param', icon: 'sensors', description: 'Event type for action', snippet: 'on: "change"', cursorOffset: -1 }
            ]
        };
        
        // Initialize the autocomplete
        this.init();
    }
    
    init() {
        // Listen for input events
        this.editor.addEventListener('input', this.onInput.bind(this));
        this.editor.addEventListener('keydown', (e) => {
            this.onKeyDown(e);
            
            // For arrow keys, update position after a small delay
            if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key) && this.isVisible) {
                setTimeout(() => this.positionContainer(), 10);
            }
        });
        
        this.editor.addEventListener('click', () => this.hide());
        this.editor.addEventListener('blur', (e) => {
            // Only hide if we're not clicking on the autocomplete itself
            if (!this.container.contains(e.relatedTarget)) {
                this.hide();
            }
        });
        
        // Track cursor movement with mouse clicks
        this.editor.addEventListener('mouseup', () => {
            if (this.isVisible) {
                this.positionContainer();
            }
        });
        
        // Track selection changes
        document.addEventListener('selectionchange', () => {
            if (document.activeElement === this.editor && this.isVisible) {
                this.positionContainer();
            }
        });
        
        // Listen for clicks on suggestions
        this.container.addEventListener('click', (e) => {
            const item = e.target.closest('.autocomplete-item');
            if (item) {
                const index = Array.from(this.list.children).indexOf(item);
                this.selectSuggestion(index);
            }
        });
        
        // Handle window resize to reposition the container if it's visible
        window.addEventListener('resize', () => {
            if (this.isVisible) {
                this.positionContainer();
            }
        });
        
        // Handle editor scroll to reposition the container
        this.editor.addEventListener('scroll', () => {
            if (this.isVisible) {
                this.positionContainer();
            }
        });
        
        // Start real-time cursor position monitoring
        this.startCursorMonitoring();
    }
    
    startCursorMonitoring() {
        // Store last known cursor position
        this.lastCursorPosition = { start: 0, end: 0 };
        
        // Check cursor position regularly
        this.cursorMonitorInterval = setInterval(() => {
            if (this.isVisible && document.activeElement === this.editor) {
                const newStart = this.editor.selectionStart;
                const newEnd = this.editor.selectionEnd;
                
                // If cursor position changed
                if (newStart !== this.lastCursorPosition.start || 
                    newEnd !== this.lastCursorPosition.end) {
                    
                    // Update position
                    this.positionContainer();
                    
                    // Store new position
                    this.lastCursorPosition = { start: newStart, end: newEnd };
                }
            }
        }, 100); // Check every 100ms
    }
    
    getElementDescription(elementName) {
        const descriptions = {
            'heading1': 'Level 1 heading (h1)',
            'heading2': 'Level 2 heading (h2)',
            'heading3': 'Level 3 heading (h3)',
            'heading4': 'Level 4 heading (h4)',
            'heading5': 'Level 5 heading (h5)',
            'heading6': 'Level 6 heading (h6)',
            'paragraph': 'Paragraph of text (p)',
            'group': 'Group container (div)',
            'span': 'Inline text container (span)',
            'list': 'Unordered list (ul)',
            'orderedlist': 'Ordered list (ol)',
            'item': 'List item (li)',
            'link': 'Hyperlink (a)',
            'image': 'Image (img)',
            'divider': 'Horizontal divider (hr)',
            'linebreak': 'Line break (br)',
            'quote': 'Block quotation (blockquote)',
            'code': 'Code snippet (code)',
            'preformatted': 'Preformatted text (pre)',
            'table': 'Table (table)',
            'row': 'Table row (tr)',
            'cell': 'Table cell (td)',
            'header': 'Table header (th)',
            'button': 'Button (button)',
            'input': 'Input field (input)',
            'form': 'Form (form)'
        };
        
        return descriptions[elementName] || elementName;
    }
    
    onInput() {
        const cursorPos = this.editor.selectionStart;
        const text = this.editor.value.substring(0, cursorPos);
        
        // Get the current word being typed (everything after the last space or newline)
        const lastSpace = text.lastIndexOf(' ');
        const lastNewline = text.lastIndexOf('\n');
        const startPos = Math.max(lastSpace, lastNewline) + 1;
        
        // Store the current word start position and text for later use
        this.currentWordStart = startPos;
        this.currentWord = text.substring(startPos).trim();
        
        // Check for various contexts to show suggestions
        if (text.match(/\.[\w]*$/)) {
            // Suggest modifiers after a dot
            this.updateModifierSuggestions(text);
        } else if (text.match(/\([\w]*$/)) {
            // Suggest parameters in brackets
            this.updateParameterSuggestions(text);
        } else if (text.match(/snippet\[\]?$/)) {
            // After typing snippet[, show snippet suggestions
            this.updateSnippetSuggestions();
        } else if (this.currentWord.length > 0) {
            // As soon as the user starts typing a word, show element suggestions
            this.updateElementSuggestions(this.currentWord);
        } else if (text.endsWith('\n') || text.endsWith(' ') || text === '') {
            // At the start of a line or after a space, show all elements
            this.updateElementSuggestions('');
        } else {
            this.hide();
            return;
        }
        
        // If we didn't hide the container, make sure it's properly positioned
        if (this.isVisible) {
            this.positionContainer();
        }
    }
    
    updateElementSuggestions(currentWord) {
        // Filter elements based on the current word
        const filteredElements = this.suggestions.elements.filter(item => 
            item.text.toLowerCase().includes(currentWord.toLowerCase())
        );
        
        if (filteredElements.length > 0) {
            this.showSuggestions(filteredElements);
        } else {
            this.hide();
        }
    }
    
    updateSuggestions(text) {
        // This is now just a wrapper for updateElementSuggestions
        // Find the current word
        const words = text.split(/\s+/);
        const currentWord = words[words.length - 1].toLowerCase();
        this.updateElementSuggestions(currentWord);
    }
    
    updateModifierSuggestions(text) {
        const modifierPrefix = text.match(/\.([\w]*)$/)[1].toLowerCase();
        const filteredModifiers = this.suggestions.modifiers.filter(item => 
            item.text.toLowerCase().includes(modifierPrefix)
        );
        
        if (filteredModifiers.length > 0) {
            this.showSuggestions(filteredModifiers);
        } else {
            this.hide();
        }
    }
    
    updateParameterSuggestions(text) {
        const paramPrefix = text.match(/\(([\w]*)$/)[1].toLowerCase();
        const filteredParams = this.suggestions.parameters.filter(item => 
            item.text.toLowerCase().includes(paramPrefix)
        );
        
        if (filteredParams.length > 0) {
            this.showSuggestions(filteredParams);
        } else {
            this.hide();
        }
    }
    
    updateSnippetSuggestions() {
        this.showSuggestions(this.suggestions.snippets);
    }
    
    showSuggestions(suggestions) {
        if (suggestions.length === 0) {
            this.hide();
            return;
        }
        
        // Store the current container dimensions before updating
        let oldHeight = 0;
        if (this.isVisible) {
            oldHeight = this.container.offsetHeight;
        }
        
        this.currentSuggestions = suggestions;
        // Semi-focus the first item but don't fully select it
        this.selectedIndex = 0; // Always select the first item by default
        this.userHasNavigated = false; // Reset navigation flag when showing new suggestions
        this.list.innerHTML = '';
        
        // Create and append suggestion elements
        suggestions.forEach((suggestion, index) => {
            const item = document.createElement('div');
            item.className = 'autocomplete-item';
            // Semi-focused state for the first item if no user interaction yet
            if (index === 0) item.className += ' semi-focused';
            
            item.innerHTML = `
                <span class="material-icons item-icon">${suggestion.icon || 'code'}</span>
                <span class="item-text">${suggestion.displayText}</span>
                <span class="item-type">${suggestion.type}</span>
            `;
            item.title = suggestion.description || '';
            this.list.appendChild(item);
        });
        
        // If it wasn't visible before, position it for the first time
        if (!this.isVisible) {
            this.positionContainer();
            this.isVisible = true;
            this.container.style.display = 'block';
        } else {
            // If it was already visible, adjust for height changes
            setTimeout(() => {
                // Re-position using the positioning logic
                this.positionContainer();
            }, 0);
            
            // Keep it visible
            this.container.style.display = 'block';
        }
    }
    
    positionContainer() {
        // Force refresh cursor position calculation on each positioning request
        this.editor.focus();
        
        // Get current cursor position
        const cursorPos = this.getCursorPosition();
        const editorRect = this.editor.getBoundingClientRect();
        
        // Horizontal offset to the right of the cursor
        let left = cursorPos.left + 20; // Add 20px offset to the right
        
        // Make sure container doesn't exceed right edge of editor
        const maxLeft = editorRect.width - 250; // Assuming container width is about 250px
        if (left > maxLeft) {
            left = maxLeft;
        }
        
        // Get line height for vertical alignment
        const styles = window.getComputedStyle(this.editor);
        const lineHeight = parseFloat(styles.lineHeight) || 20;
        
        // First, position it horizontally
        this.container.style.left = `${left}px`;
        
        // Calculate line top position
        const lineTop = cursorPos.top - (cursorPos.top % lineHeight);
        
        // Calculate offset to center the first autocomplete item with the line
        // Autocomplete item has 4px padding top/bottom, list has 2px padding top
        // So the first item's center is at: 2px (list padding) + 4px (item padding) + fontSize/2
        const fontSize = 14; // autocomplete item font size
        const itemHeight = fontSize + 8; // font size + vertical padding (4px * 2)
        const firstItemCenterOffset = 2 + 4 + (fontSize / 2); // list padding + item padding + half font size
        
        // Position container so the first item is vertically centered with the current line
        // We offset upward by (firstItemCenterOffset - lineHeight/2) to align centers
        const verticalOffset = firstItemCenterOffset - (lineHeight / 2);
        // Add 66px offset to shift the container down
        this.container.style.top = `${lineTop - verticalOffset + 70}px`;
        
        // After rendering, check if it needs repositioning
        setTimeout(() => {
            const containerRect = this.container.getBoundingClientRect();
            
            // If the container is too far down, reposition above the cursor
            if (containerRect.bottom > window.innerHeight) {
                this.container.style.top = `${lineTop - containerRect.height}px`;
            }
            
            // If too far to the right, adjust leftward
            if (containerRect.right > window.innerWidth) {
                this.container.style.left = `${window.innerWidth - containerRect.width - 20}px`;
            }
        }, 0);
        
        // For debugging purposes, add a small indicator at the calculated cursor position
        this.updateCursorIndicator(cursorPos);
    }
    
    // Helper method to visualize cursor position for debugging (can be removed in production)
    updateCursorIndicator(cursorPos) {
        let indicator = document.getElementById('cursor-position-debug');
        if (!indicator && false) { // Set to true only during development
            indicator = document.createElement('div');
            indicator.id = 'cursor-position-debug';
            indicator.style.position = 'absolute';
            indicator.style.width = '5px';
            indicator.style.height = '5px';
            indicator.style.backgroundColor = 'red';
            indicator.style.borderRadius = '50%';
            indicator.style.zIndex = '2000';
            document.body.appendChild(indicator);
        }
        
        if (indicator) {
            const editorRect = this.editor.getBoundingClientRect();
            indicator.style.left = `${editorRect.left + cursorPos.left}px`;
            indicator.style.top = `${editorRect.top + cursorPos.top}px`;
        }
    }
    
    getCursorPosition() {
        // Create a hidden div with the same styling as the textarea
        const div = document.createElement('div');
        const styles = window.getComputedStyle(this.editor);
        
        // Copy styles to maintain text positioning
        ['font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'padding-left', 'padding-top', 'width', 'padding', 'border', 'box-sizing', 'text-indent'].forEach(style => {
            div.style[style] = styles[style];
        });
        
        div.style.position = 'absolute';
        div.style.top = '0';
        div.style.left = '0';
        div.style.visibility = 'hidden';
        div.style.whiteSpace = 'pre-wrap';
        div.style.height = 'auto';
        div.style.overflow = 'hidden'; // Prevent scrollbars from affecting measurements
        
        // Get text before cursor
        const textBeforeCursor = this.editor.value.substring(0, this.editor.selectionStart);
        
        // Split by newlines to get the current line
        const lines = textBeforeCursor.split('\n');
        const currentLineIndex = lines.length - 1;
        const currentLine = lines[currentLineIndex];
        
        // Add the text content for accurate measurement
        div.textContent = lines.slice(0, currentLineIndex).join('\n');
        if (div.textContent && !div.textContent.endsWith('\n')) {
            div.textContent += '\n';
        }
        
        // Create a span for the current line up to the cursor
        const currentLineSpan = document.createElement('span');
        currentLineSpan.textContent = currentLine;
        div.appendChild(currentLineSpan);
        
        // Add span to mark cursor position
        const cursorSpan = document.createElement('span');
        cursorSpan.id = 'cursor-position-marker';
        cursorSpan.textContent = '|'; // Add a character to get the correct position
        div.appendChild(cursorSpan);
        
        document.body.appendChild(div);
        
        // Get position of cursor span
        const rect = cursorSpan.getBoundingClientRect();
        const editorRect = this.editor.getBoundingClientRect();
        
        // Clean up
        document.body.removeChild(div);
        
        // Calculate position relative to the editor
        // Add scrollTop and scrollLeft to account for scrolling
        return {
            left: rect.left - editorRect.left + this.editor.scrollLeft,
            top: rect.top - editorRect.top + this.editor.scrollTop
        };
    }
    
    hide() {
        this.isVisible = false;
        this.container.style.display = 'none';
        this.userHasNavigated = false; // Reset navigation flag when hiding
        
        // Clear the cursor monitor interval if suggestions are hidden
        if (this.cursorMonitorInterval) {
            clearInterval(this.cursorMonitorInterval);
            this.cursorMonitorInterval = null;
        }
    }
    
    onKeyDown(e) {
        if (!this.isVisible) return;
        
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                this.userHasNavigated = true;
                this.selectNext();
                break;
            case 'ArrowUp':
                e.preventDefault();
                this.userHasNavigated = true;
                this.selectPrevious();
                break;
            case 'Enter':
                if (this.userHasNavigated && this.selectedIndex >= 0) {
                    e.preventDefault();
                    this.insertSuggestion(this.selectedIndex);
                } else {
                    // On Enter without navigation, hide the autocomplete
                    this.hide();
                }
                break;
            case 'Tab':
                e.preventDefault();
                // Tab always selects the currently highlighted item, even if not user-navigated
                if (this.selectedIndex >= 0) {
                    this.insertSuggestion(this.selectedIndex);
                }
                break;
            case 'Escape':
                e.preventDefault();
                this.hide();
                break;
        }
    }
    
    selectNext() {
        const nextIndex = (this.selectedIndex + 1) % this.currentSuggestions.length;
        this.highlightItem(nextIndex);
    }
    
    selectPrevious() {
        const prevIndex = this.selectedIndex <= 0 
            ? this.currentSuggestions.length - 1 
            : this.selectedIndex - 1;
        this.highlightItem(prevIndex);
    }
    
    highlightItem(index) {
        // Remove previous highlight and semi-focus
        const items = this.list.querySelectorAll('.autocomplete-item');
        items.forEach(item => {
            item.classList.remove('selected');
            item.classList.remove('semi-focused');
        });
        
        // Add highlight to selected item
        if (index >= 0 && index < items.length) {
            if (this.userHasNavigated) {
                // Full selection for user-navigated items
                items[index].classList.add('selected');
            } else {
                // Semi-focus for default selection
                items[index].classList.add('semi-focused');
            }
            
            this.selectedIndex = index;
            
            // Ensure selected item is visible in scroll
            items[index].scrollIntoView({ block: 'nearest' });
        } else {
            // If index is negative or invalid, make sure nothing is selected
            this.selectedIndex = -1;
        }
    }
    
    selectSuggestion(index) {
        this.insertSuggestion(index);
    }
    
    insertSuggestion(index) {
        if (index < 0 || index >= this.currentSuggestions.length) return;
        
        const suggestion = this.currentSuggestions[index];
        const cursorPos = this.editor.selectionStart;
        const text = this.editor.value;
        
        // Find what to replace
        let startPos = cursorPos;
        const prevText = text.substring(0, cursorPos);
        
        // Determine replacement logic based on context
        if (prevText.match(/\.[\w]*$/)) {
            // For modifiers, replace after the dot
            const match = prevText.match(/\.[\w]*$/);
            startPos = cursorPos - match[0].length + 1; // +1 to keep the dot
            
            // Use insertText if specified, otherwise use text
            const insertText = suggestion.insertText || suggestion.text;
            this.replaceText(startPos, cursorPos, insertText);
        } else if (prevText.match(/\([\w]*$/)) {
            // For parameters, replace after the open parenthesis
            const match = prevText.match(/\([\w]*$/);
            startPos = cursorPos - match[0].length + 1; // +1 to keep the parenthesis
            
            // Insert the parameter
            const snippet = suggestion.snippet || suggestion.text;
            this.replaceText(startPos, cursorPos, snippet);
            
            // Adjust cursor for snippets with cursorOffset
            if (suggestion.cursorOffset) {
                const newCursorPos = startPos + snippet.length + suggestion.cursorOffset;
                this.editor.selectionStart = this.editor.selectionEnd = newCursorPos;
            }
        } else if (prevText.match(/snippet\[\]?$/)) {
            // For snippet suggestions
            const match = prevText.match(/snippet\[\]?$/);
            startPos = cursorPos - match[0].length;
            
            this.replaceText(startPos, cursorPos, suggestion.snippet);
            
            // Adjust cursor position
            if (suggestion.cursorOffset) {
                const newCursorPos = startPos + suggestion.snippet.length + suggestion.cursorOffset;
                this.editor.selectionStart = this.editor.selectionEnd = newCursorPos;
            }
        } else {
            // For elements or other suggestions
            // Use the tracked position of the start of the current word
            startPos = this.currentWordStart;
            
            // Handle snippet insertion - use the suggestion's snippet or full text
            const insertText = suggestion.snippet || suggestion.text;
            
            // Replace the current word with the suggestion
            this.replaceText(startPos, cursorPos, insertText);
            
            // Position cursor inside brackets if needed
            if (suggestion.type === 'element' && insertText.endsWith('[')) {
                this.editor.selectionStart = this.editor.selectionEnd = startPos + insertText.length;
            }
        }
        
        // Hide the suggestions and update the preview
        this.hide();
        updatePreview();
    }
    
    replaceText(start, end, replacement) {
        const text = this.editor.value;
        this.editor.value = text.substring(0, start) + replacement + text.substring(end);
        this.editor.selectionStart = this.editor.selectionEnd = start + replacement.length;
        this.editor.focus();
    }
}