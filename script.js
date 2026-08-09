// 1. DEFINE CUSTOM PyCJ SYNTAX HIGHLIGHTER
CodeMirror.defineMode("pycj", function() {
    return {
        startState: function() { return { inString: false, stringQuote: "" }; },
        token: function(stream, state) {
            if (state.inString) {
                if (stream.match("{")) {
                    while (!stream.eol()) {
                        if (stream.match("}", false)) { stream.next(); return "string-interpolation"; }
                        stream.next();
                    }
                    return "string-interpolation";
                }
                if (stream.match("\\" + state.stringQuote)) return "string";
                if (stream.match(state.stringQuote)) { state.inString = false; return "string"; }
                stream.next(); return "string";
            }
            if (stream.match("//", false)) { stream.skipToEnd(); return "comment"; }
            if (stream.match("/*", false)) {
                stream.next(); stream.next();
                while (!stream.eol()) {
                    if (stream.match("*/", false)) { stream.next(); stream.next(); return "comment"; }
                    stream.next();
                }
                return "comment";
            }
            if (stream.match('"') || stream.match("'")) { state.inString = true; state.stringQuote = stream.current(); return "string"; }
            if (stream.match(/\b(?:imagine|echo|ask|if|elif|else|repeat|until|while|for|in|craft|return|halt|Yes|No|stop|skip|attempt|rescue|lock|then|USE|PyCJ|match|remove)\b/i)) return "keyword";
            if (stream.match(/\b(?:int|float|str|string|bool|random|sqrt|abs|max|min|len|add|pycj)\b/i)) return "builtin";
            if (stream.match(/\b\d+(?:\.\d+)?\b/)) return "number";
            if (stream.match(/[+\-*\/%=<>!&|]+/)) return "operator";
            if (stream.match(/[{}()\[\];,.]/)) return "punctuation";
            if (stream.match(/[a-zA-Z_]\w*/)) return "variable";
            stream.next(); return null;
        }
    };
});

document.addEventListener("DOMContentLoaded", () => {
    const welcomeCode = `USE PyCJ

// Welcome to PyCJ! The easiest programming language.
ask string name = "What is your name? "
echo "Welcome, {name}!"

lock PI = 3.14
imagine score = random(1, 100)
echo "You scored: {score}"

match score {
    100 {
        echo "Perfect Score! You mastered PyCJ!"
    }
    else {
        echo "Keep learning, {name}!"
    }
}

// Dictionaries in PyCJ
imagine student = {
   name = "Arshman"
   age = 15
   is_student = Yes
}

student(name) = name
student(age) = 16
student.remove = is_student

echo "Student Name: {student(name)}"
echo "Student Age: {student(age)}"

for key in student {
    echo "Key: {key}"
}

// Lambda Functions (Anonymous Functions)
imagine adder = (a, b) => {
    return a + b
}
echo "5 + 10 = {adder(5, 10)}"

craft greet(user) {
    echo "Hello {user}, enjoy coding!"
}
greet(name)

echo "-" * 20
halt(0);`;

    const autosaveToggle = document.getElementById("autosave-toggle");
    let isAutosaveOn = localStorage.getItem('pycj_autosave') !== 'false';
    autosaveToggle.checked = isAutosaveOn;

    let initialCode = welcomeCode;
    const hash = window.location.hash;
    
    if (hash.startsWith('#code=')) {
        let compressed = hash.substring(6);
        try {
            initialCode = LZString.decompressFromEncodedURIComponent(compressed) || welcomeCode;
        } catch (e) {
            initialCode = welcomeCode;
        }
        history.replaceState(null, '', window.location.pathname);
    } else if (isAutosaveOn) {
        initialCode = localStorage.getItem('pycj_code') || welcomeCode;
    } else {
        localStorage.removeItem('pycj_code');
    }

    document.getElementById("code-editor").value = initialCode;

    const editor = CodeMirror.fromTextArea(document.getElementById("code-editor"), {
        lineNumbers: true, indentUnit: 4, mode: "pycj", theme: "pycj",
        styleActiveLine: true, autoCloseBrackets: { pairs: "()[]{}''\"\"", explode: "" }, matchBrackets: true,
        extraKeys: {
            "Ctrl-Enter": () => runCode(), "Cmd-Enter": () => runCode(),
            "Tab": (cm) => cm.replaceSelection("    ", "end"),
            "Enter": (cm) => {
                const cursor = cm.getCursor();
                const lineText = cm.getLine(cursor.line);
                const beforeCursor = lineText.substring(0, cursor.ch);
                const afterCursor = lineText.substring(cursor.ch);
                const endsWithBlock = beforeCursor.trim().endsWith("{") || beforeCursor.trim().endsWith(":");
                const hasClosingBracket = afterCursor.startsWith("}") || afterCursor.startsWith(")") || afterCursor.startsWith("]");
                const currentIndentMatch = lineText.match(/^\s*/);
                let indent = currentIndentMatch ? currentIndentMatch[0] : "";
                let insertText = "\n" + indent;
                if (endsWithBlock) insertText += "    ";
                if (hasClosingBracket) insertText += "\n" + indent;
                cm.replaceSelection(insertText, "end");
                let newLine = cursor.line + 1;
                let newCh = indent.length;
                if (endsWithBlock) newCh += 4;
                cm.setCursor({ line: newLine, ch: newCh });
            }
        }
    });

    const outputDiv = document.getElementById("output");
    const runBtn = document.getElementById("run-btn");
    const themeToggle = document.getElementById("theme-toggle");
    const workspace = document.getElementById("workspace");
    const tabCode = document.getElementById("tab-code");
    const tabConsole = document.getElementById("tab-console");
    const uploadBtn = document.getElementById("upload-btn");
    const downloadBtn = document.getElementById("download-btn");
    const fileInput = document.getElementById("file-input");
    const menuToggle = document.getElementById("menu-toggle");
    const mainDropdown = document.getElementById("main-dropdown");
    
    const shareCodeBtn = document.getElementById("share-code-btn");
    const clearTerminalBtn = document.getElementById("clear-terminal-btn");
    const shareModal = document.getElementById("share-modal");
    const modalCloseBtn = document.getElementById("modal-close-btn");
    const modalCopyBtn = document.getElementById("modal-copy-btn");
    const shareUrlInput = document.getElementById("share-url-input");

    const terminalInputContainer = document.getElementById("terminal-input-container");
    const terminalPromptText = document.getElementById("terminal-prompt");
    const terminalInputField = document.getElementById("terminal-input-field");

    menuToggle.addEventListener("click", (e) => { e.stopPropagation(); mainDropdown.classList.toggle("active"); });
    document.addEventListener("click", (e) => {
        if (!mainDropdown.contains(e.target) && e.target !== menuToggle) mainDropdown.classList.remove("active");
    });

    autosaveToggle.addEventListener("change", () => {
        isAutosaveOn = autosaveToggle.checked;
        localStorage.setItem('pycj_autosave', isAutosaveOn);
        if (!isAutosaveOn) {
            localStorage.removeItem('pycj_code');
        }
    });

    shareCodeBtn.addEventListener("click", () => {
        let code = editor.getValue();
        let compressed = LZString.compressToEncodedURIComponent(code);
        let baseUrl = window.location.origin + window.location.pathname;
        let shareUrl = `${baseUrl}#code=${compressed}`;
        shareUrlInput.value = shareUrl;
        shareModal.style.display = "flex";
    });

    modalCloseBtn.addEventListener("click", () => shareModal.style.display = "none");
    modalCopyBtn.addEventListener("click", () => {
        shareUrlInput.select();
        document.execCommand('copy');
        modalCopyBtn.innerText = "✅ Copied!";
        setTimeout(() => { modalCopyBtn.innerText = "Copy Link"; }, 2000);
    });

    clearTerminalBtn.addEventListener("click", () => {
        outputDiv.innerHTML = "";
        addTerminalLine("Terminal Cleared.", "var(--text-console-prompt)");
    });

    function showTerminalView() {
        if (window.matchMedia('(max-width: 1100px)').matches) {
            tabCode.classList.remove("active"); tabConsole.classList.add("active");
            workspace.classList.remove("show-editor"); workspace.classList.add("show-console");
        }
    }

    let saveTimeout;
    editor.on("change", () => {
        if (isAutosaveOn) {
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => localStorage.setItem('pycj_code', editor.getValue()), 500);
        }
    });

    uploadBtn.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => { editor.setValue(event.target.result); if (isAutosaveOn) localStorage.setItem('pycj_code', event.target.result); };
        reader.readAsText(file);
    });

    downloadBtn.addEventListener("click", () => {
        const blob = new Blob([editor.getValue()], {type: "text/plain"});
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob); a.download = "pycj_code.txt"; a.click(); URL.revokeObjectURL(a.href);
    });

    themeToggle.addEventListener("click", () => {
        document.body.classList.toggle("light-theme"); document.body.classList.toggle("dark-theme");
    });

    tabCode.addEventListener("click", () => {
        tabCode.classList.add("active"); tabConsole.classList.remove("active");
        workspace.classList.remove("show-console"); workspace.classList.add("show-editor");
        setTimeout(() => editor.refresh(), 10);
    });
    tabConsole.addEventListener("click", () => {
        tabConsole.classList.add("active"); tabCode.classList.remove("active");
        workspace.classList.remove("show-editor"); workspace.classList.add("show-console");
    });

    function addTerminalLine(text, color = "var(--text-console)") {
        const lineDiv = document.createElement("div");
        lineDiv.className = "console-line"; lineDiv.style.color = color; lineDiv.innerText = text;
        outputDiv.appendChild(lineDiv); outputDiv.scrollTop = outputDiv.scrollHeight;
    }

    function waitForInput(promptText) {
        return new Promise((resolve) => {
            terminalPromptText.innerText = promptText;
            terminalInputContainer.style.display = "flex";
            terminalInputField.value = "";
            terminalInputField.focus();

            function handleSubmit(e) {
                if (e.key === "Enter") {
                    const val = terminalInputField.value;
                    terminalInputContainer.style.display = "none";
                    terminalInputField.removeEventListener("keydown", handleSubmit);
                    addTerminalLine(promptText + val, "var(--text-console-prompt)");
                    resolve(val);
                }
            }
            terminalInputField.addEventListener("keydown", handleSubmit);
        });
    }

    function setRunState() {
        runBtn.disabled = false; runBtn.classList.remove("btn-stop"); runBtn.classList.add("btn-primary");
        runBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"></path></svg> Run`;
    }

    function setStopState() {
        runBtn.disabled = false; runBtn.classList.remove("btn-primary"); runBtn.classList.add("btn-stop");
        runBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h12v12H6z"></path></svg> Stop`;
    }

    async function runCode() {
        if (runBtn.classList.contains("btn-stop")) {
            setRunState();
            addTerminalLine("--- Execution Stopped By User ---", "var(--error-color)");
            return;
        }

        const code = editor.getValue();
        setStopState();
        showTerminalView();
        outputDiv.innerHTML = "";
        addTerminalLine("--- Executing PyCJ Script ---", "var(--accent-color)");
        
        await new Promise(r => setTimeout(r, 50));

        try {
            const result = await window.runPyCJ(code, addTerminalLine, waitForInput);

            if (result.error) {
                if (result.error.type === "PyCJWarning") {
                    const warnDiv = document.createElement("div");
                    warnDiv.className = "console-warning-box";
                    warnDiv.innerHTML = `⚠️ ${result.error.message}`;
                    outputDiv.appendChild(warnDiv);
                } 
                else if (result.error.type === "PyCJMultiError") {
                    const errDiv = document.createElement("div");
                    errDiv.className = "console-error-box";
                    let html = `<div class="err-title">SYNTAX ERROR!</div>`;
                    html += `<div class="err-trace">Traceback (most recent call last):<br>File "<main.pycj>"</div>`;
                    result.error.errors.forEach(err => {
                        html += `<div style="margin-bottom:6px; padding-left:10px;">→ Line ${err.line}: ${err.msg}</div>`;
                        html += `<div class="err-fix">${err.fix}</div>`;
                    });
                    html += `<div class="err-footer">=== Code Exited With Errors ===</div>`;
                    errDiv.innerHTML = html;
                    outputDiv.appendChild(errDiv);
                } 
                else if (result.error.type === "PyCJError") {
                    const errDiv = document.createElement("div");
                    errDiv.className = "console-error-box";
                    let html = `<div class="err-title">ERROR! ${result.error.message}</div>`;
                    
                    if (result.error.line > 0) {
                        html += `<div class="err-trace">Traceback (most recent call last):<br>File "<main.pycj>", line ${result.error.line}, in <module></div>`;
                        html += `<pre class="err-code">${result.error.snippet}\n${result.error.caret}</pre>`;
                    } else {
                        html += `<div class="err-trace">Failed to compile script. The error is somewhere in your code.</div>`;
                    }
                    
                    html += `<div class="err-fix">${result.error.fix}</div>`;
                    html += `<div class="err-footer">=== Code Exited With Errors ===</div>`;
                    errDiv.innerHTML = html;
                    outputDiv.appendChild(errDiv);
                } else {
                    const errDiv = document.createElement("div");
                    errDiv.className = "console-error-box";
                    errDiv.innerHTML = `
                        <div class="err-title">ERROR! ${result.error.message || result.error}</div>
                        <div class="err-trace">Traceback (most recent call last):<br>File "<main.pycj>"</div>
                        <div class="err-footer">=== Code Exited With Errors ===</div>
                    `;
                    outputDiv.appendChild(errDiv);
                }
            } else {
                const exitDiv = document.createElement("div");
                exitDiv.className = "console-exit-box";
                exitDiv.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"></path></svg> Code returned with value of ${result.exitCode}`;
                outputDiv.appendChild(exitDiv);
            }
        } catch (error) {
            const errDiv = document.createElement("div");
            errDiv.className = "console-error-box";
            errDiv.innerHTML = `
                <div class="err-title">ERROR! ${error.message}</div>
                <div class="err-footer">=== Code Exited With Errors ===</div>
            `;
            outputDiv.appendChild(errDiv);
        } finally {
            setRunState();
            outputDiv.scrollTop = outputDiv.scrollHeight;
        }
    }

    runBtn.addEventListener("click", runCode);
});
