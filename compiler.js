window.compilePyCJ = function(code) {
    // 1. MANDATORY HEADER CHECK
    if (!code.trim().toLowerCase().startsWith('use pycj')) {
        throw new Error("Add 'USE PYCJ' at first to make it use proper");
    }
    code = code.replace(/^\s*use\s+pycj\b/i, '');

    // 2. Remove Comments Early
    code = code.replace(/\/\/.*$/gm, '');
    code = code.replace(/\/\*[\s\S]*?\*\//g, '');
    code = code.replace(/#.*$/gm, '');

    // 3. Strict Syntax Validation
    let cleanCode = code.replace(/"([^"]*)"/g, '""').replace(/'([^']*)'/g, "''");
    const forbidden = {
        'print': "Use 'output()' instead of 'print()'.",
        'console.log': "Use 'output()' instead of 'console.log()'.",
        'let ': "Use 'imagine' instead of 'let'.",
        'const ': "Use 'lock' instead of 'const'.",
        'var ': "Use 'imagine' instead of 'var'.",
        'true': "Use 'Yes' instead of 'true'.",
        'false': "Use 'No' instead of 'false'.",
        'break': "Use 'stop' instead of 'break'.",
        'continue': "Use 'skip' instead of 'continue'.",
        'try': "Use 'attempt' instead of 'try'.",
        'catch': "Use 'rescue' instead of 'catch'."
    };
    for (let word in forbidden) {
        let regex = new RegExp(`\\b${word}\\b`, 'i');
        if (regex.test(cleanCode)) throw new Error(`Foreign syntax detected! ${forbidden[word]}`);
    }
    if (/\bend\s*\([^)]*\)\s*(?!;)/i.test(cleanCode)) throw new Error("PyCJ Warning: Make sure to put ; at end of end statement so it work");

    // 4. Smart String Interpolation ("Hello {name}" -> `Hello ${name}`)
    code = code.replace(/"([^"]*)"/g, (match, content) => {
        let newContent = content.replace(/\{([a-zA-Z_]\w*)\}/g, '${$1}');
        return newContent.includes('${') ? '`' + newContent + '`' : match;
    });
    code = code.replace(/'([^']*)'/g, (match, content) => {
        let newContent = content.replace(/\{([a-zA-Z_]\w*)\}/g, '${$1}');
        return newContent.includes('${') ? '`' + newContent + '`' : match;
    });

    // 5. Normalize structural keywords to lowercase
    code = code.replace(/\b(if|elif|else|repeat|until|for|while|return|function|imagine|output|ask|end|int|float|str|string|bool|stop|skip|attempt|rescue|lock|then|not|and|or|match)\b/gi, (m) => m.toLowerCase());

    // 6. Multiple Return Values (return a, b -> return [a, b])
    code = code.replace(/\breturn\s+([a-zA-Z_0-9\.]+(?:\s*,\s*[a-zA-Z_0-9\.]+)+)/g, (match, p1) => 'return [' + p1 + ']');
    // 7. Array Destructuring (imagine x, y = func() -> let [x, y] = func())
    code = code.replace(/\bimagine\s+([a-zA-Z_]\w*(?:\s*,\s*[a-zA-Z_]\w*)+)\s*=/g, 'imagine [$1] =');
    // 8. String Multiplication ("-" * 30 OR "*" * i -> "-".repeat(30) OR "*".repeat(i))
    code = code.replace(/(["'`][^"'`]+["'`])\s*\*\s*([a-zA-Z_]\w*|\d+)/g, '$1.repeat($2)');
    code = code.replace(/([a-zA-Z_]\w*|\d+)\s*\*\s*(["'`][^"'`]+["'`])/g, '$2.repeat($1)');

    // 9. Variables & Constants
    code = code.replace(/\bimagine\b/g, 'let');
    code = code.replace(/\block\b/g, 'const');

    // 10. Output & End
    code = code.replace(/\boutput\b/g, 'console.log');
    code = code.replace(/\bend\s*\(([^)]*)\)\s*;/g, '__end__($1);');

    // 11. Input Handling (NOW ASYNC!)
    code = code.replace(/\bask\s+(int|float|str|string|bool)\s+(\w+)\s*=\s*`([^`]*)`/gi, (m, type, varName, promptText) => parseAsk(type, varName, promptText));
    code = code.replace(/\bask\s+(int|float|str|string|bool)\s+(\w+)\s*=\s*"([^"]*)"/gi, (m, type, varName, promptText) => parseAsk(type, varName, promptText));

    // 12. Math Operators
    code = code.replace(/([a-zA-Z_]\w*)\s*\/=\/=\s*([a-zA-Z0-9_\(\)\.]+)/g, '$1 = Math.floor($1 / $2)');
    code = code.replace(/([a-zA-Z0-9_\)\]]+)\s*\/=\/\s*([a-zA-Z0-9_\(\.]+)/g, 'Math.floor($1 / $2)');

    // 13. Booleans & Logical Operators
    code = code.replace(/\byes\b/gi, 'true');
    code = code.replace(/\bno\b/gi, 'false');
    code = code.replace(/\band\b/gi, '&&');
    code = code.replace(/\bor\b/gi, '||');
    code = code.replace(/\bnot\b/gi, '!');

    // 14. Loop Control & Error Handling
    code = code.replace(/\bstop\b/g, 'break');
    code = code.replace(/\bskip\b/g, 'continue');
    code = code.replace(/\battempt\b/g, 'try');
    code = code.replace(/\brescue\b/g, 'catch(e)');

    // 15. List Methods
    code = code.replace(/\.add\(/g, '.push(');
    code = code.replace(/\.len\(\)/g, '.length');
    code = code.replace(/\.remove\(/g, '.pycjRemove(');

    // 16. C-style For Loop
    code = code.replace(/for\s*\(\s*(?:int\s+)?([a-zA-Z_]\w*)\s*=\s*([^,]+)\s*,\s*\1\s*(<=?|>=?|==|!=)\s*([^,]+)\s*,\s*\1(\+\+|--)\s*\)/g, 'for (let $1 = $2; $1 $3 $4; $1$5)');

    // 17. PyCJ Range Loop (Explicit Operators: range(1, <=, 5))
    code = code.replace(/for\s+([a-zA-Z_]\w*)\s+in\s+range\s*\(\s*([^,)]+)\s*,\s*(<=|>=|<|>|!=)\s*,\s*([^,)]+)\s*\)/g, (match, v, s, o, e) => {
        if (o === '<') return `for (let ${v} = ${s}; ${v} < ${e}; ${v}++)`;
        if (o === '<=') return `for (let ${v} = ${s}; ${v} <= ${e}; ${v}++)`;
        if (o === '>') return `for (let ${v} = ${s}; ${v} > ${e}; ${v}--)`;
        if (o === '>=') return `for (let ${v} = ${s}; ${v} >= ${e}; ${v}--)`;
        return match;
    });
    // Standard Inclusive Range Loop: range(1, 5)
    code = code.replace(/for\s+([a-zA-Z_]\w*)\s+in\s+range\s*\(\s*([^,)]+)\s*,\s*([^,)]+)\s*\)/g, 'for (let $1 = $2; $1 <= $3; $1++)');

    // 18. Repeat...Until
    code = code.replace(/\brepeat\s*\{/g, 'do {');
    code = code.replace(/\buntil\s+(.*?)(?=\n)/g, 'while (!($1));');

    // 19. Ternary Operator
    code = code.replace(/\bif\s+(.*?)\s+then\s+(.*?)\s+else\s+(.*?)(?=[;\n\)\],])/g, '(($1) ? ($2) : ($3))');

    // 20. Match Statement
    code = translateMatchStatements(code);
    code = code.replace(/\belse\s+if\b/g, 'else if');

    return code;
}

function parseAsk(type, varName, promptText) {
    type = type.toLowerCase();
    // Uses await __ask__ to pause execution and wait for terminal input
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

// Execution Environment (NOW ASYNC)
window.runPyCJ = async function(pycjCode, logCallback, inputCallback) {
    let jsCode = window.compilePyCJ(pycjCode);
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
            logCallback(str, "var(--token-string)"); // Live output to terminal
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
        let val = await inputCallback(promptText); // Calls the UI input function
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
            error = e.message;
            if (error.includes("is not defined")) {
                error = error.replace(" is not defined", " is not defined (Check for missing variables or typos)");
            }
            exitCode = 1;
        }
    }
    
    return { exitCode: exitCode, error: error, debug_js: jsCode };
}
