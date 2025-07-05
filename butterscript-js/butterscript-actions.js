/**
 * ButterscriptActions - A utility class for handling actions in butterscript
 */
class ButterscriptActions {
    constructor() {
        this.registeredActions = {};

        // Register standard actions
        this.registerStandardActions();
        
        // Initialize action handlers once DOM is loaded
        document.addEventListener('DOMContentLoaded', () => this.initActionHandlers());
    }

    /**
     * Initialize action handlers by scanning the DOM for elements with data-action attributes
     */
    initActionHandlers() {
        // Find all elements with data-action attribute
        const actionElements = document.querySelectorAll('[data-action]');
        
        actionElements.forEach(element => {
            const actionData = element.dataset.action;
            if (!actionData) return;
            
            // Parse action data (format: action-name:target-id:extra-params)
            const [actionName, targetId, ...params] = actionData.split(':');
            
            // Add event listener for the appropriate event (default to click)
            const eventType = element.dataset.actionEvent || 'click';
            
            element.addEventListener(eventType, (event) => {
                event.preventDefault();
                this.executeAction(actionName, targetId, params, element, event);
            });
        });
    }

    /**
     * Execute an action by name
     * @param {string} actionName - The name of the action to execute
     * @param {string} targetId - The ID of the target element
     * @param {Array} params - Additional parameters for the action
     * @param {HTMLElement} triggerElement - The element that triggered the action
     * @param {Event} event - The original DOM event
     */
    executeAction(actionName, targetId, params, triggerElement, event) {
        // Check if action is registered
        if (this.registeredActions[actionName]) {
            this.registeredActions[actionName](targetId, params, triggerElement, event);
        } else {
            console.warn(`Action "${actionName}" is not registered.`);
        }
    }

    /**
     * Register a custom action
     * @param {string} actionName - The name of the action
     * @param {Function} actionHandler - The function to handle the action
     */
    registerAction(actionName, actionHandler) {
        this.registeredActions[actionName] = actionHandler;
    }

    /**
     * Register all standard actions
     */
    registerStandardActions() {
        // Toggle visibility of an element
        this.registerAction('toggle', (targetId) => {
            const targetElement = document.getElementById(targetId);
            if (targetElement) {
                if (targetElement.style.display === 'none') {
                    targetElement.style.display = '';
                } else {
                    targetElement.style.display = 'none';
                }
            }
        });

        // Show an element
        this.registerAction('show', (targetId) => {
            const targetElement = document.getElementById(targetId);
            if (targetElement) {
                targetElement.style.display = '';
            }
        });

        // Hide an element
        this.registerAction('hide', (targetId) => {
            const targetElement = document.getElementById(targetId);
            if (targetElement) {
                targetElement.style.display = 'none';
            }
        });

        // Submit a form
        this.registerAction('submit', (targetId, params, triggerElement) => {
            const form = targetId ? document.getElementById(targetId) : null;
            
            if (form && form.tagName === 'FORM') {
                // Actual HTML form element
                form.submit();
            } else if (form) {
                // Could be a butterscript group with form elements
                const formElements = form.querySelectorAll('form');
                if (formElements.length > 0) {
                    formElements[0].submit();
                } else {
                    // If no actual form element, create and trigger a submit event
                    const submitEvent = new Event('submit', {
                        bubbles: true,
                        cancelable: true
                    });
                    form.dispatchEvent(submitEvent);
                }
            } else if (!targetId) {
                // If no target ID, find the closest form relative to trigger
                const closestForm = triggerElement.closest('form');
                if (closestForm) {
                    closestForm.submit();
                } else {
                    // Last resort - try to find any form on the page
                    const forms = document.querySelectorAll('form');
                    if (forms.length === 1) {
                        forms[0].submit();
                    }
                }
            }
        });

        // Reset a form
        this.registerAction('reset', (targetId, params, triggerElement) => {
            const form = targetId ? document.getElementById(targetId) : null;
            
            if (form && form.tagName === 'FORM') {
                // Actual HTML form element
                form.reset();
            } else if (form) {
                // Could be a butterscript group with form elements
                const formElements = form.querySelectorAll('form');
                if (formElements.length > 0) {
                    formElements[0].reset();
                } else {
                    // If it's a container with input elements, reset those
                    const inputs = form.querySelectorAll('input, textarea, select');
                    inputs.forEach(input => {
                        if (input.type === 'checkbox' || input.type === 'radio') {
                            input.checked = input.defaultChecked;
                        } else {
                            input.value = input.defaultValue;
                        }
                    });
                }
            } else if (!targetId) {
                // If no target ID, find the closest form relative to trigger
                const closestForm = triggerElement.closest('form');
                if (closestForm) {
                    closestForm.reset();
                } else {
                    // Last resort - try to find any form on the page
                    const forms = document.querySelectorAll('form');
                    if (forms.length === 1) {
                        forms[0].reset();
                    }
                }
            }
        });

        // Navigate to a URL
        this.registerAction('navigate', (url) => {
            if (url) {
                // Fix URL handling by ensuring it has proper protocol
                if (!url.match(/^https?:\/\//i) && !url.startsWith('/')) {
                    url = 'https://' + url;
                }
                window.location.href = url;
            }
        });

        // Open a URL in a new tab
        this.registerAction('open', (url) => {
            if (url) {
                // Fix URL handling by ensuring it has proper protocol
                if (!url.match(/^https?:\/\//i) && !url.startsWith('/')) {
                    url = 'https://' + url;
                }
                window.open(url, '_blank');
            }
        });

        // Copy text to clipboard
        this.registerAction('copy', (_, params, triggerElement) => {
            // Get text from first parameter or from the element content
            const textToCopy = params[0] || triggerElement.textContent.trim();
            
            navigator.clipboard.writeText(textToCopy).then(() => {
                // Show success feedback
                const originalText = triggerElement.textContent;
                triggerElement.textContent = 'Copied!';
                
                // Reset after 2 seconds
                setTimeout(() => {
                    triggerElement.textContent = originalText;
                }, 2000);
            });
        });

        // Toggle a class on an element
        this.registerAction('toggleClass', (targetId, params) => {
            if (!params || params.length === 0) return;
            
            const targetElement = document.getElementById(targetId);
            if (targetElement) {
                targetElement.classList.toggle(params[0]);
            }
        });
        
        // Add a class to an element
        this.registerAction('addClass', (targetId, params) => {
            if (!params || params.length === 0) return;
            
            const targetElement = document.getElementById(targetId);
            if (targetElement) {
                targetElement.classList.add(params[0]);
            }
        });
        
        // Remove a class from an element
        this.registerAction('removeClass', (targetId, params) => {
            if (!params || params.length === 0) return;
            
            const targetElement = document.getElementById(targetId);
            if (targetElement) {
                targetElement.classList.remove(params[0]);
            }
        });
        
        // Show an alert
        this.registerAction('alert', (_, params) => {
            const message = params[0] || 'Alert';
            // Add toast notification before showing the alert to verify action is triggered
            if (typeof showToast === 'function') {
                showToast('Alert action triggered');
            }
            alert(message);
        });
        
        // Confirm action
        this.registerAction('confirm', (targetId, params, triggerElement, event) => {
            const message = params[0] || 'Are you sure?';
            if (!confirm(message)) {
                event.stopImmediatePropagation();
            }
        });
        
        // Export HTML action
        this.registerAction('exportHTML', () => {
            if (typeof downloadHTML === 'function') {
                downloadHTML();
            } else {
                console.warn('downloadHTML function not available');
            }
        });
        
        // Export butterscript action
        this.registerAction('exportButterscript', () => {
            if (typeof downloadButterscript === 'function') {
                downloadButterscript();
            } else {
                console.warn('downloadButterscript function not available');
            }
        });
    }
}

// Create a global instance of the actions handler
const butterActions = new ButterscriptActions();

// Export for module use if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = butterActions;
}

// Add a public method to reinitialize action handlers
// This will be called after the preview is updated
butterActions.reinitializeHandlers = function() {
    this.initActionHandlers();
};

// Toggle preview panel visibility
function togglePreviewPanel() {
    const editorContainer = document.querySelector('.editor-container');
    editorContainer.classList.toggle('preview-hidden');
    
    // Store the preference in local storage
    const isPreviewHidden = editorContainer.classList.contains('preview-hidden');
    localStorage.setItem('butterscript_preview_hidden', isPreviewHidden);
    
    // Update the editor layout
    if (editor) {
        setTimeout(() => editor.refresh(), 100);
    }
    
    showToast(isPreviewHidden ? 'Preview hidden' : 'Preview visible');
}

// Show about dialog
function showAbout() {
    const aboutModal = document.createElement('div');
    aboutModal.className = 'modal-overlay';
    
    const aboutContent = document.createElement('div');
    aboutContent.className = 'modal-content';
    aboutContent.innerHTML = `
        <div class="modal-header">
            <img src="butterscript-assets/butterscript-logo.svg" alt="butterscript" height="40">
            <h2>About butterscript</h2>
            <button class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
            <p>butterscript is a natural markup language that blends human-readable syntax with powerful formatting capabilities.</p>
            <p>Version 1.0</p>
            <p>Built with ❤️ for elegant text formatting</p>
        </div>
    `;
    
    aboutModal.appendChild(aboutContent);
    document.body.appendChild(aboutModal);
    
    // Close modal when clicking the close button or outside the modal
    const closeBtn = aboutModal.querySelector('.modal-close');
    closeBtn.addEventListener('click', () => {
        document.body.removeChild(aboutModal);
    });
    
    aboutModal.addEventListener('click', (e) => {
        if (e.target === aboutModal) {
            document.body.removeChild(aboutModal);
        }
    });
}

// Handle menu navigation with keyboard
document.addEventListener('keydown', function(e) {
    // Additional keyboard shortcuts
    if (e.metaKey || e.ctrlKey) {
        // Toggle preview with Cmd+P
        if (e.key === 'p') {
            e.preventDefault();
            togglePreviewPanel();
        }
        
        // Export shortcuts
        if (e.shiftKey) {
            if (e.key === 'H' || e.key === 'h') {
                e.preventDefault();
                downloadHTML();
            } else if (e.key === 'S' || e.key === 's') {
                e.preventDefault();
                downloadButterscript();
            }
        }
    }
});

// Initialize with previous preview state
document.addEventListener('DOMContentLoaded', function() {
    // Check if preview was previously hidden
    const isPreviewHidden = localStorage.getItem('butterscript_preview_hidden') === 'true';
    if (isPreviewHidden) {
        document.querySelector('.editor-container').classList.add('preview-hidden');
    }
    
    // Explicitly reinitialize action handlers to ensure they're attached
    // This helps with dynamic content and ensures all handlers are properly set up
    if (butterActions && typeof butterActions.reinitializeHandlers === 'function') {
        setTimeout(() => butterActions.reinitializeHandlers(), 100);
    }
    
    // Initialize existing functionality
    // ... other initializations ...
}); 