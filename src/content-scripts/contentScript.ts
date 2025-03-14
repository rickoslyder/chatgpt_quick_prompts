/// <reference types="chrome"/>
import { Prompt, getPrompts } from "../utils/storage";

// Main container for quick prompt buttons
let quickPromptsContainer: HTMLElement | null = null;

// Keep track of the currently observed composer
let observedComposer: Element | null = null;

// A unique identifier for this container
const containerId = "chatgpt-quick-prompts-container-" + Date.now();

// Determine which site we're on
const currentSite = (() => {
  const url = window.location.href;
  if (url.includes("chat.openai.com") || url.includes("chatgpt.com")) {
    return "chatgpt";
  } else if (url.includes("grok.com")) {
    return "grok";
  } else if (url.includes("x.com/i/grok")) {
    return "x-grok";
  }
  return "unknown";
})();

// Check if we're on Grok homepage (not in a conversation)
const isGrokHomepage = () => {
  return currentSite === "grok" && !window.location.pathname.includes("/c/");
};

/**
 * Cleans up existing prompt containers to avoid duplicates
 */
function cleanupExistingContainers() {
  // Find all quick prompt containers
  const existingContainers = document.querySelectorAll(
    ".chatgpt-quick-prompts-container"
  );
  existingContainers.forEach((container) => {
    // Don't remove our own container if it exists
    if (container.id !== containerId) {
      container.remove();
    }
  });
}

// Get the appropriate target element for Grok based on the current page
function getGrokTargetElement(): Element | null {
  // First try conversation page input
  let targetElement = document.querySelector(
    "div.relative.z-40.flex.flex-col.items-center.w-full > div.relative.w-full"
  );

  // If not found, try the homepage input
  if (!targetElement) {
    targetElement = document.querySelector(
      "div.flex.flex-col.items-center.w-full.gap-1 > div.flex.flex-col-reverse.items-center.justify-between.flex-1.w-full > form"
    );
  }

  // If still not found, try the original selector as a fallback
  if (!targetElement) {
    targetElement = document.querySelector(
      "body > div > div > main > div.relative.flex.flex-col.items-center.h-full.\\@container\\/main > div.absolute.bottom-0.mx-auto.inset-x-0.max-w-\\[50rem\\].z-50"
    );
  }

  return targetElement;
}

// Observe DOM changes for dynamic UI injection
const observer = new MutationObserver(() => {
  // Find the target element based on current site
  let targetElement: Element | null = null;

  if (currentSite === "chatgpt") {
    targetElement = document.querySelector("#composer-background");
  } else if (currentSite === "grok") {
    targetElement = getGrokTargetElement();
  } else if (currentSite === "x-grok") {
    targetElement = document.querySelector(
      "#react-root > div > div > div.css-175oi2r.r-1f2l425.r-13qz1uu.r-417010.r-18u37iz > main > div > div > div > div > div > div.r-6koalj.r-eqz5dr.r-1pi2tsx.r-13qz1uu > div > div > div.css-175oi2r.r-1p0dtai.r-gtdqiz.r-13qz1uu"
    );
  }

  // If no target or we're already observing this one, do nothing
  if (!targetElement || targetElement === observedComposer) {
    return;
  }

  // We found a new target - clean up and inject
  observedComposer = targetElement;
  cleanupExistingContainers();
  injectPromptButtons(targetElement);
});

/**
 * Injects prompt buttons into the UI
 */
async function injectPromptButtons(targetElement: Element) {
  try {
    // Get prompts from storage
    const prompts = await getPrompts();

    // If no prompts, don't inject anything
    if (!prompts || prompts.length === 0) {
      return;
    }

    // Remove existing container if it exists
    if (
      quickPromptsContainer &&
      document.body.contains(quickPromptsContainer)
    ) {
      quickPromptsContainer.remove();
      quickPromptsContainer = null;
    }

    // Create container for prompt buttons
    quickPromptsContainer = document.createElement("div");
    quickPromptsContainer.className = "chatgpt-quick-prompts-container";
    quickPromptsContainer.id = containerId;
    quickPromptsContainer.style.display = "flex";
    quickPromptsContainer.style.flexWrap = "wrap";
    quickPromptsContainer.style.gap = "8px";
    quickPromptsContainer.style.margin = "8px 0";
    quickPromptsContainer.style.padding = "8px";
    quickPromptsContainer.style.borderRadius = "8px";
    quickPromptsContainer.style.backgroundColor = "rgba(247, 247, 248, 0.1)";
    quickPromptsContainer.style.width = "100%";
    quickPromptsContainer.style.zIndex = "50"; // Ensure it's visible
    quickPromptsContainer.style.position = "relative"; // Fix visibility on conversation page

    // Center buttons on Grok homepage
    if (isGrokHomepage()) {
      quickPromptsContainer.style.justifyContent = "center";
    }

    // Add prompt buttons to container
    prompts.forEach((prompt) => {
      const button = createPromptButton(prompt);
      quickPromptsContainer!.appendChild(button);
    });

    // Insert container based on the current site
    if (currentSite === "chatgpt") {
      // Original ChatGPT insertion - after composer background
      if (targetElement.parentElement) {
        targetElement.parentElement.insertBefore(
          quickPromptsContainer,
          targetElement.nextSibling
        );
      }
    } else if (currentSite === "grok" || currentSite === "x-grok") {
      // For Grok on grok.com and x.com, append as the last child
      targetElement.appendChild(quickPromptsContainer);
    }
  } catch (error) {
    console.error("Error injecting prompt buttons:", error);
  }
}

/**
 * Insert text with preserved line breaks at the cursor position
 * @param range The DOM range to insert at
 * @param text The text to insert
 * @param needsInitialLineBreak Whether to add a line break before the text
 */
function insertTextWithLineBreaks(
  range: Range,
  text: string,
  needsInitialLineBreak: boolean
): void {
  // Insert initial line break if needed
  if (needsInitialLineBreak) {
    const br = document.createElement("br");
    range.insertNode(br);
    range.setStartAfter(br);
    range.collapse(true);
  }

  // Split the text by line breaks
  const lines = text.split("\n");

  // Create a document fragment to hold all our nodes
  const fragment = document.createDocumentFragment();

  // Add each line with line breaks between them
  lines.forEach((line, index) => {
    if (index > 0) {
      // Add line break between lines (not before the first line)
      fragment.appendChild(document.createElement("br"));
    }

    if (line.length > 0) {
      fragment.appendChild(document.createTextNode(line));
    }
  });

  // Insert the fragment at the current position
  range.insertNode(fragment);

  // Move cursor to after the inserted content
  range.collapse(false);
}

/**
 * Handles insertion into a standard textarea element (like those used by Grok)
 */
function insertTextIntoTextarea(
  textareaElement: HTMLTextAreaElement,
  text: string
): void {
  // Get the cursor position
  const start = textareaElement.selectionStart || 0;
  const end = textareaElement.selectionEnd || 0;

  // Current value
  const currentValue = textareaElement.value;

  // Insert the text at cursor position or replace selected text
  const newValue =
    currentValue.substring(0, start) + text + currentValue.substring(end);

  // Update the textarea value
  textareaElement.value = newValue;

  // Set cursor position after inserted text
  const newCursorPos = start + text.length;
  textareaElement.selectionStart = newCursorPos;
  textareaElement.selectionEnd = newCursorPos;

  // Dispatch input event to trigger UI updates
  textareaElement.dispatchEvent(new Event("input", { bubbles: true }));
}

/**
 * Safely insert text at the current cursor position
 * Handles complex DOM structure and selection states
 */
function insertTextAtCursorPosition(
  inputElement: HTMLElement,
  text: string
): void {
  // For standard textareas (like Grok uses), use the simpler method
  if (inputElement.tagName.toLowerCase() === "textarea") {
    insertTextIntoTextarea(inputElement as HTMLTextAreaElement, text);
    return;
  }

  // For contenteditable elements (like ChatGPT uses)
  // Store current focus state
  const wasAlreadyFocused = document.activeElement === inputElement;

  // Focus the element to ensure we can modify it
  inputElement.focus();

  // Get current selection
  const selection = window.getSelection();
  if (!selection) {
    // Fallback: Just set the innerText (preserves line breaks)
    inputElement.innerText = text;
    return;
  }

  // Handle selection or insert at cursor
  if (selection.rangeCount > 0) {
    // Get the selected range
    const range = selection.getRangeAt(0);

    // If there's text selected, replace it with our prompt
    if (!selection.isCollapsed) {
      // Delete the selected content
      range.deleteContents();
    }

    // Check if we need a line break before inserting
    // If we're at the beginning of the input, don't add a line break
    const needsLineBreak =
      range.startOffset > 0 &&
      !range.startContainer.textContent
        ?.substring(0, range.startOffset)
        .endsWith("\n");

    // Insert the text with proper line breaks
    insertTextWithLineBreaks(range, text, needsLineBreak);

    // Update the selection
    selection.removeAllRanges();
    selection.addRange(range);
  } else {
    // No range available, fallback to appending
    const currentText = inputElement.innerText;
    inputElement.innerText = currentText ? currentText + "\n" + text : text;
  }

  // Manually dispatch input event for the UI to detect the change
  inputElement.dispatchEvent(new Event("input", { bubbles: true }));

  // Keep focus if it was already focused
  if (!wasAlreadyFocused) {
    // We intentionally leave it focused since we just inserted text
  }
}

/**
 * Find the input element for the current site
 */
function findInputElement(): HTMLElement | null {
  if (currentSite === "chatgpt") {
    return document.querySelector("#prompt-textarea");
  } else if (currentSite === "grok") {
    // Find Grok.com input element - try multiple selectors
    const selectors = [
      // Conversation page textarea
      'textarea[aria-label="Ask Grok anything"]',
      // Homepage textarea
      "div.flex.flex-col.items-center.w-full textarea",
      // Generic contenteditable
      '[contenteditable="true"]',
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) return element as HTMLElement;
    }

    return null;
  } else if (currentSite === "x-grok") {
    // Find X.com Grok input element
    return document.querySelector('[data-testid="tweetTextarea_0"]');
  }

  return null;
}

/**
 * Creates a button element for a prompt
 */
function createPromptButton(prompt: Prompt): HTMLElement {
  const button = document.createElement("button");

  // Explicitly set type="button" to prevent form submission
  button.type = "button";

  // Use the prompt name if available, otherwise use truncated text
  const displayText =
    prompt.name ||
    (prompt.text.length > 15
      ? prompt.text.substring(0, 15) + "..."
      : prompt.text);

  button.textContent = displayText;
  button.title = prompt.text;
  button.style.padding = "6px 12px";
  button.style.borderRadius = "4px";
  button.style.border = "none";
  button.style.background = prompt.color || "#444654";
  button.style.color = "#ffffff";
  button.style.fontSize = "14px";
  button.style.cursor = "pointer";
  button.style.transition = "background 0.3s";

  // Add hover effect
  button.onmouseover = () => {
    button.style.filter = "brightness(1.1)";
  };
  button.onmouseout = () => {
    button.style.filter = "brightness(1)";
  };

  // Add click handler to inject prompt text
  button.onclick = (event) => {
    // Prevent default button behavior and stop event propagation
    event.preventDefault();
    event.stopPropagation();

    // Find the input element
    const inputElement = findInputElement();

    if (inputElement) {
      console.log("Found input element:", inputElement);

      // Insert text at cursor position or replace selection
      insertTextAtCursorPosition(inputElement, prompt.text);

      // Find any submit buttons and ensure our prompt doesn't trigger them
      const submitButton = document.querySelector(
        'button[data-testid="send-button"]'
      );
      if (submitButton) {
        // Make sure we don't accidentally submit
        setTimeout(() => {
          // This ensures we don't interfere with any event loops currently executing
          console.log("Prompt insertion complete - cursor position preserved");
        }, 50);
      }
    } else {
      console.error("Could not find input element for text insertion");
    }

    // Return false for good measure (old-school way to prevent defaults)
    return false;
  };

  return button;
}

// Start observing DOM changes for dynamic injection
observer.observe(document.body, {
  childList: true,
  subtree: true,
});

// Initial cleanup and injection
cleanupExistingContainers();

// Initial injection based on current site
let initialTargetElement: Element | null = null;

if (currentSite === "chatgpt") {
  initialTargetElement = document.querySelector("#composer-background");
} else if (currentSite === "grok") {
  initialTargetElement = getGrokTargetElement();
} else if (currentSite === "x-grok") {
  initialTargetElement = document.querySelector(
    "#react-root > div > div > div.css-175oi2r.r-1f2l425.r-13qz1uu.r-417010.r-18u37iz > main > div > div > div > div > div > div.r-6koalj.r-eqz5dr.r-1pi2tsx.r-13qz1uu > div > div > div.css-175oi2r.r-1p0dtai.r-gtdqiz.r-13qz1uu"
  );
}

if (initialTargetElement) {
  observedComposer = initialTargetElement;
  injectPromptButtons(initialTargetElement);
}

// Listen for storage changes to update buttons
chrome.storage.onChanged.addListener(
  (changes: { [key: string]: chrome.storage.StorageChange }) => {
    if (changes.prompts) {
      // Clean up existing containers first
      cleanupExistingContainers();

      // Re-inject buttons when prompts change based on current site
      let targetElement: Element | null = null;

      if (currentSite === "chatgpt") {
        targetElement = document.querySelector("#composer-background");
      } else if (currentSite === "grok") {
        targetElement = getGrokTargetElement();
      } else if (currentSite === "x-grok") {
        targetElement = document.querySelector(
          "#react-root > div > div > div.css-175oi2r.r-1f2l425.r-13qz1uu.r-417010.r-18u37iz > main > div > div > div > div > div > div.r-6koalj.r-eqz5dr.r-1pi2tsx.r-13qz1uu > div > div > div.css-175oi2r.r-1p0dtai.r-gtdqiz.r-13qz1uu"
        );
      }

      if (targetElement) {
        observedComposer = targetElement;
        injectPromptButtons(targetElement);
      }
    }
  }
);
