window.compilePyCJ = function(code) {
    if (!/^\s*USE PYCJ\b/.test(code)) throw new Error("Write in capital! Make it USE PYCJ");
    code = code.replace(/^\s*USE PYCJ\b/, '');

    code = code.replace(/\/\/.*$/gm, '');
    code = code.replace(/\/\*[\s\S]*?\*\//g, '');
    code = code.replace(/#.*$/gm, '');

    let cleanCode = code.replace(/"([^"]*)"/g, '""').replace(/'([^']*)'/g, "''");
    const forbidden = {
        'print': "Use 'echo()' instead of 'print()'.",
        'console.log': "Use 'echo()' instead of 'console.log()'.",
        'output': "Use 'echo()' instead of 'output()'.",
        'let ': "Use 'imagine' instead of 'let'.",
        'const ': "Use 'lock' instead of 'const'.",
        'var ': "Use 'imagine' instead of 'var'.",
        'function ': "Use 'craft' instead of 'function'.",
        'true': "Use 'Yes' instead of 'true'.",
        'false': "Use 'No' instead of 'false'.",
        'break': "Use 'stop' instead of 'break'.",
        'continue': "Use 'skip' instead of 'continue'.",
        'try': "Use 'attempt' instead of 'try'.",
        'catch': "Use 'rescue' instead of 'catch'.",
        'end': "Use 'halt()' instead of 'end()'."
    };
    for (let word in forbidden) {
        let regex = new RegExp(`\\b${word}\\b`, 'i');
        if (regex.test(cleanCode)) throw new Error(`Foreign syntax detected! ${forbidden[word]}`);
    }
    if (/\bhalt\s*\([^)]*\)\s*(?!;)/i.test(cleanCode)) throw new Error("PyCJ Warning: Make sure to put ; at end of halt statement so it work");

    code = code.replace(/"([^"]*)"/g, (match, content) => {
        let n = content.replace(/\{([^{}]+)\}/g, '${$1}');
        return n.includes('${') ? '`' + n + '`' : match;
    });
    code = code.replace(/'([^']*)'/g, (match, content) => {
        let n = content.replace(/\{([^{}]+)\}/g, '${$1}');
        return n.includes('${') ? '`' + n + '`' : match;
    });

    code = code.replace(/\b(if|elif|else|repeat|until|for|while|return|craft|imagine|echo|ask|halt|int|float|str|string|bool|stop|skip|attempt|rescue|lock|then|not|and|or|match|in)\b/gi, (m) => m.toLowerCase());

    code = code.replace(/\bif\s+(.*?)\s*\{/g, 'if ($1) {');
    code = code.replace(/\bwhile\s+(.*?)\s*\{/g, 'while ($1) {');

    let dictNames = [];
    let dictRegex = /\b(?:imagine|lock)\s+([a-zA-Z_]\w*)\s*=\s*\{/g;
    let m;
    while ((m = dictRegex.exec(code)) !== null) dictNames.push(m[1]);

    code = code.replace(/=\s*\{([\s\S]*?)\}/g, (match, content) => {
        let n = content.trim().replace(/\n/g, ', ').replace(/(\w+)\s*=(?!=)\s*/g, '"$1": ').replace(/,\s*$/, '');
        return `= { ${n} }`;
    });

    dictNames.forEach(name => {
        code = code.replace(new RegExp(`\\b${name}\\(\\s*(\\w+)\\s*\\)`, 'g'), `${name}.$1`);
        code = code.replace(new RegExp(`\\b${name}\\.remove\\s*=\\s*(\\w+)`, 'g'), `delete ${name}.$1;`);
    });

    code = code.replace(/for\s+([a-zA-Z_]\w*)\s*,\s*([a-zA-Z_]\w*)\s+in\s+([a-zA-Z_]\w*)\s*\{/g, (match, k, v, obj) => `for (let [${k}, ${v}] of Object.entries(${obj})) {`);
    code = code.replace(/for\s+([a-zA-Z_]\w*)\s+in\s+([a-zA-Z_]\w*)\s*\{/g, (match, k, obj) => {
        if (dictNames.includes(obj)) return `for (let ${k} in ${obj}) {`;
        return `for (let ${k} of ${obj}) {`;
    });

    code = code.replace(/\breturn\s+([^;\n]+,[^;\n]+)\n/g, (match, p1) => `return [${p1.trim()}]\n`);
    code = code.replace(/\bimagine\s+([a-zA-Z_]\w*(?:\s*,\s*[a-zA-Z_]\w*)+)\s*=/g, 'imagine [$1] =');
    code = code.replace(/(["'`][^"'`]+["'`])\s*\*\s*([a-zA-Z_]\w*|\d+)/g, '$1.repeat($2)');
    code = code.replace(/([a-zA-Z_]\w*|\d+)\s*\*\s*(["'`][^"'`]+["'`])/g, '$2.repeat($1)');

    code = code.replace(/\bcraft\b/g, 'function');
    code = code.replace(/\bimagine\b/g, 'let');
    code = code.replace(/\block\b/g, 'const');

    code = code.replace(/\becho\s*\(/g, 'console.log(');
    code = code.replace(/^(\s*)echo\s+(.*?)(\s*\/\/.*)?;?\s*$/gm, (match, indent, expr, comment) => {
        return `${indent}console.log(${expr.trim()});${comment || ''}`;
    });

    code = code.replace(/\bhalt\s*\(([^)]*)\)\s*;/g, '__end__($1);');

    code = code.replace(/\bask\s+(int|float|str|string|bool)\s+(\w+)\s*=\s*`([^`]*)`/gi, (m, t, v, p) => parseAsk(t, v, p));
    code = code.replace(/\bask\s+(int|float|str|string|bool)\s+(\w+)\s*=\s*"([^"]*)"/gi, (m, t, v, p) => parseAsk(t, v, p));

    code = code.replace(/\s*\/=\/=\s*/g, ' //== ');
    code = code.replace(/\s*\/=\/\s*/g, ' /=~ ');
    code = code.replace(/([a-zA-Z_]\w*)\s*\/\/==\s*([a-zA-Z0-9_\(\)\.]+)/g, '$1 = Math.floor($1 / $2)');
    code = code.replace(/([a-zA-Z0-9_\)\]]+)\s*\/=~\s*([a-zA-Z0-9_\(\.]+)/g, 'Math.floor($1 / $2)');

    code = code.replace(/\byes\b/gi, 'true');
    code = code.replace(/\bno\b/gi, 'false');
    code = code.replace(/\band\b/gi, '&&');
    code = code.replace(/\bor\b/gi, '||');
    code = code.replace(/\bnot\b/gi, '!');

    code = code.replace(/\bstop\b/g, 'break');
    code = code.replace(/\bskip\b/g, 'continue');
    code = code.replace(/\battempt\b/g, 'try');
    code = code.replace(/\brescue\b/g, 'catch(e)');

    code = code.replace(/\.add\(/g, '.push(');
    code = code.replace(/\.len\(\)/g, '.length');
    code = code.replace(/\.remove\(/g, '.pycjRemove(');

    code = code.replace(/for\s*\(\s*(?:int\s+)?([a-zA-Z_]\w*)\s*=\s*([^,]+)\s*,\s*\1\s*(<=?|>=?|==|!=)\s*([^,]+)\s*,\s*\1(\+\+|--)\s*\)/g, 'for (let $1 = $2; $1 $3 $4; $1$5)');

    code = code.replace(/for\s+([a-zA-Z_]\w*)\s+in\s+range\s*\(\s*([^,)]+)\s*,\s*(<=|>=|<|>|!=)\s*,\s*([^,)]+)\s*\)/g, (match, v, s, o, e) => {
        if (o === '<') return `for (let ${v} = ${s}; ${v} < ${e}; ${v}++)`;
        if (o === '<=') return `for (let ${v} = ${s}; ${v} <= ${e}; ${v}++)`;
        if (o === '>') return `for (let ${v} = ${s}; ${v} > ${e}; ${v}--)`;
        if (o === '>=') return `for (let ${v} = ${s}; ${v} >= ${e}; ${v}--)`;
        return match;
    });
    code = code.replace(/for\s+([a-zA-Z_]\w*)\s+in\s+range\s*\(\s*([^,)]+)\s*,\s*([^,)]+)\s*\)/g, 'for (let $1 = $2; $1 <= $3; $1++)');

    code = code.replace(/\brepeat\s*\{/g, 'do {');
    code = code.replace(/\buntil\s+(.*?)(?=\n)/g, 'while (!($1));');
    code = code.replace(/\bif\s+(.*?)\s+then\s+(.*?)\s+else\s+(.*?)(?=[;\n\)\],])/g, '(($1) ? ($2) : ($3))');

    code = translateMatchStatements(code);
    code = code.replace(/\belse\s+if\b/g, 'else if');

    return code;
}

function parseAsk(type, varName, promptText) {
    type = type.toLowerCase();
    return `${varName} = await __ask__('${type}', ${JSON.stringify(promptText)});`;
}

function translateMatchStatements(code) {
    let lines = code.split('\n');
    let newLines = [];
    let inMatch = false;
    let matchVar = "";
    let matchBraceDepth = 0;
    let firstCase = true;

    for (let line of lines) {
        if (inMatch) {
            let stripped = line.trim();
            let opens = (stripped.match(/{/g) || []).length;
            let closes = (stripped.match(/}/g) || []).length;

            matchBraceDepth += (opens - closes);
            if (matchBraceDepth <= 0) {
                inMatch = false;
                continue; 
            }

            let caseMatch = stripped.match(/^([^\s}].*?)\s*\{$/);
            if (caseMatch) {
                let val = caseMatch[1].trim();
                let originalIndent = line.match(/^(\s*)/)[1];

                if (val.toLowerCase() === 'else') {
                    newLines.push(originalIndent + 'else {');
                } else {
                    if (firstCase) {
                        newLines.push(originalIndent + `if (${matchVar} == ${val}) {`);
                        firstCase = false;
                    } else {
                        newLines.push(originalIndent + `else if (${matchVar} == ${val}) {`);
                    }
                }
            } else {
                newLines.push(line);
            }
            continue;
        }

        let matchStart = line.match(/^(\s*)match\s+(.+?)\s*\{/i);
        if (matchStart) {
            inMatch = true;
            matchVar = matchStart[2].trim();
            matchBraceDepth = 1;
            firstCase = true;
            continue;
        }

        newLines.push(line);
    }
    return newLines.join('\n');
}

// --- NEW: STATIC SYNTAX LINTER ---
function lintSyntax(code) {
    let errors = [];
    let lines = code.split('\n');
    let stack = []; // Tracks {, (, [
    
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        // Remove strings so brackets inside strings don't count
        let cleanLine = line.replace(/"([^"\\]|\\.)*"/g, '""').replace(/'([^'\\]|\\.)*'/g, "''").replace(/`([^`\\]|\\.)*`/g, "``");
        
        for (let char of cleanLine) {
            if (char === '{' || char === '(' || char === '[') {
                stack.push({ char, line: i + 1 });
            } else if (char === '}' || char === ')' || char === ']') {
                if (stack.length === 0) {
                    errors.push({ msg: `Unexpected closing bracket '${char}'`, line: i + 1 });
                } else {
                    let last = stack.pop();
                    let expected = char === '}' ? '{' : (char === ')' ? '(' : '[');
                    if (last.char !== expected) {
                        errors.push({ msg: `Mismatched bracket: expected '${expected}' but found '${char}'`, line: i + 1 });
                    }
                }
            }
        }
    }
    
    // Any brackets left in the stack were never closed
    stack.forEach(item => {
        errors.push({ msg: `Missing closing bracket for '${item.char}'`, line: item.line });
    });
    
    return errors;
}

// --- NEW: RUNTIME ERROR FORMATTER ---
function formatRuntimeError(e, originalCode) {
    let jsLine = 1;
    // JS stack traces contain the line number in the format <anonymous>:LINE:COL
    let stackMatch = e.stack.match(/<anonymous>:(\d+):(\d+)/);
    if (stackMatch) {
        jsLine = parseInt(stackMatch[1]);
    }

    // Map JS line back to PyCJ line. (Our async wrapper adds 1 line of overhead at the top, so we subtract 1)
    let pycjLine = jsLine - 1; 
    let pycjLines = originalCode.split('\n');
    let lineText = pycjLines[pycjLine - 1] || "Unknown Line";
    
    let msg = e.message;
    let errorWord = null;

    // Translate JS errors to PyCJ errors
    if (e instanceof ReferenceError) {
        errorWord = msg.replace(" is not defined", "").trim();
        msg = `Unknown variable or function '${errorWord}'`;
    } else if (e instanceof TypeError) {
        if (msg.includes("is not a function")) {
            errorWord = msg.replace(" is not a function", "").trim();
            msg = `Invalid function call: '${errorWord}' is not a function`;
        } else if (msg.includes("Cannot read properties of undefined")) {
            msg = `Invalid dictionary or object access: ${msg}`;
        } else {
            msg = `Type Error: ${msg}`;
        }
    } else if (e instanceof SyntaxError) {
        msg = `Syntax Error: ${msg}`;
    }

    // Calculate the column for the caret (^^^^^)
    let col = 1;
    let caretLen = 5;
    if (errorWord && lineText.includes(errorWord)) {
        col = lineText.indexOf(errorWord) + 1;
        caretLen = errorWord.length;
    } else if (stackMatch) {
        col = parseInt(stackMatch[2]);
    }

    let caretStr = " ".repeat(col - 1) + "^".repeat(caretLen);

    return {
        type: "PyCJError",
        message: msg,
        line: pycjLine,
        col: col,
        snippet: lineText.trim(),
        caret: caretStr.trim()
    };
}

window.runPyCJ = async function(pycjCode, logCallback, inputCallback) {
    // 0. Run Static Linter First (Catches missing } etc.)
    let syntaxErrors = lintSyntax(pycjCode);
    if (syntaxErrors.length > 0) {
        return { error: { type: "PyCJMultiError", errors: syntaxErrors } };
    }

    let jsCode;
    try {
        jsCode = window.compilePyCJ(pycjCode);
    } catch (e) {
        return { error: { type: "PyCJError", message: e.message, line: 0, col: 0, snippet: "", caret: "" } };
    }
    
    let exitCode = 0;
    let error = null;
    
    const customConsole = {
        log: function(...args) {
            let str = args.map(a => {
                if (typeof a === 'object' && a !== null) {
                    try { return JSON.stringify(a); } catch(e) { return String(a); }
                }
                return String(a);
            }).join(' ');
            logCallback(str, "var(--token-string)"); 
        }
    };

    const __end__ = (code) => { throw { isEnd: true, code: code || 0 }; };
    const random = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
    const sqrt = Math.sqrt;
    const abs = Math.abs;
    const max = Math.max;
    const min = Math.min;

    Array.prototype.pycjRemove = function(val) {
        let index = this.indexOf(val);
        if (index !== -1) this.splice(index, 1);
    };

    const __ask__ = async (type, promptText) => {
        let val = await inputCallback(promptText); 
        if (type === 'int') return parseInt(val) || 0;
        if (type === 'float') return parseFloat(val) || 0.0;
        if (type === 'bool') return val.toLowerCase() === 'yes';
        return val;
    };

    try {
        const asyncWrapper = `return (async () => { ${jsCode} })();`;
        const func = new Function('console', '__end__', 'random', 'sqrt', 'abs', 'max', 'min', '__ask__', asyncWrapper);
        await func(customConsole, __end__, random, sqrt, abs, max, min, __ask__);
    } catch (e) {
        if (e.isEnd) {
            exitCode = e.code;
        } else {
            error = formatRuntimeError(e, pycjCode);
            exitCode = 1;
        }
    }
    
    return { exitCode: exitCode, error: error };
}
