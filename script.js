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
            // ADDED 'halt' to keywords, removed 'end'
            if (stream.match(/\b(?:imagine|output|ask|if|elif|else|repeat|until|while|for|craft|return|halt|Yes|No|stop|skip|attempt|rescue|lock|then|USE|PYCJ|match)\b/i)) return "keyword";
            if (stream.match(/\b(?:int|float|str|string|bool|random|sqrt|abs|max|min|len|add|remove|pycj)\b/i)) return "builtin";
            if (stream.match(/\b\d+(?:\.\d+)?\b/)) return "number";
            if (stream.match(/[+\-*\/%=<>!&|]+/)) return "operator";
            if (stream.match(/[{}()\[\];,.]/)) return "punctuation";
            if (stream.match(/[a-zA-Z_]\w*/)) return "variable";
            stream.next(); return null;
        }
    };
});

document.addEventListener("DOMContentLoaded", () => {
    // Updated Welcome Code (USE PYCJ, craft, and halt)
    const welcomeCode = `USE PYCJ

// Welcome to PyCJ! The easiest programming language.
ask string name = "What is your name? "
output("Welcome, {name}!")

lock PI = 3.14
imagine score = random(1, 100)
output("You scored: {score}")

match score {
    100 {
        output("Perfect Score! You mastered PyCJ!")
    }
    else {
        output("Keep learning, {name}!")
    }
}

craft greet(user) {
    output("Hello {user}, enjoy coding!")
}
greet(name)

output("-" * 20)
halt(0);`;

    // --- AUTOSAVE LOGIC ---
    const autosaveToggle = document.getElementById("autosave-toggle");
    let isAutosaveOn = localStorage.getItem('pycj_autosave') !== 'false';
    autosaveToggle.checked = isAutosaveOn;

    let initialCode = welcomeCode;
    if (isAutosaveOn) {
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
                const errDiv = document.createElement("div");
                errDiv.className = "console-error-box";
                errDiv.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="flex-shrink: 0; margin-right: 8px;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"></path></svg> ${result.error}`;
                outputDiv.appendChild(errDiv);
            } else {
                const exitDiv = document.createElement("div");
                exitDiv.className = "console-exit-box";
                exitDiv.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"></path></svg> Code returned with value of ${result.exitCode}`;
                outputDiv.appendChild(exitDiv);
            }
        } catch (error) {
            const errDiv = document.createElement("div");
            errDiv.className = "console-error-box";
            errDiv.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="flex-shrink: 0; margin-right: 8px;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"></path></svg> ${error.message}`;
            outputDiv.appendChild(errDiv);
        } finally {
            setRunState();
            outputDiv.scrollTop = outputDiv.scrollHeight;
        }
    }

    runBtn.addEventListener("click", runCode);
});
