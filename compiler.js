window.compilePyCJ = function(code) {
    // 1. MANDATORY HEADER CHECK
    if (!code.trim().toLowerCase().startsWith('use pycj')) {
        throw new Error("Add 'USE PYCJ' at first to make it use proper");
    }
    
    // Remove 'use pycj'
    code = code.replace(/^\s*use\s+pycj\b/i, '');
    
    // 2. Strict Syntax Validation (Block foreign words)
    let cleanCode = code.replace(/\/\/.*/g, '').replace(/#.*/g, '');
    cleanCode = cleanCode.replace(/"([^"]*)"/g, '""').replace(/'([^']*)'/g, "''");
    
    const forbidden = {
        'print': "Use 'output()' instead of 'print()'.",
        'console.log': "Use 'output()' instead of 'console.log()'.",
        'let ': "Use 'imagine' instead of 'let'.",
        'const ': "Use 'lock' instead of 'const'.",
        'var ': "Use 'imagine' instead of 'var'.",
        'function ': "Wait, 'function' is for defining blocks. Did you mean to use it?",
        'true': "Use 'Yes' instead of 'true'.",
        'false': "Use 'No' instead of 'false'.",
        'break': "Use 'stop' instead of 'break'.",
        'continue': "Use 'skip' instead of 'continue'.",
        'try': "Use 'attempt' instead of 'try'.",
        'catch': "Use 'rescue' instead of 'catch'."
    };
    
    for (let word in forbidden) {
        let regex = new RegExp(`\\b${word}\\b`, 'i');
        if (regex.test(cleanCode)) {
            throw new Error(`Foreign syntax detected! ${forbidden[word]}`);
        }
    }

    // Check for end() without a semicolon ;
    if (/\bend\s*\([^)]*\)\s*(?!;)/i.test(cleanCode)) {
        throw new Error("PyCJ Warning: Make sure to put ; at end of end statement so it work");
    }

    // 3. Smart String Interpolation (Converts "text {var}" to `text ${var}`)
    code = code.replace(/"([^"]*\{.*?\}[^"]*)"/g, '`$1`');
    code = code.replace(/'([^']*\{.*?\}[^']*)'/g, '`$1`');

    // 4. Normalize structural keywords to lowercase
    code = code.replace(/\b(if|elif|else|repeat|until|for|while|return|function|imagine|output|ask|end|int|float|str|string|bool|stop|skip|attempt|rescue|lock|then|not|and|or|match)\b/gi, (m) => m.toLowerCase());

    // 5. Variables & Constants
    code = code.replace(/\bimagine\b/g, 'let');
    code = code.replace(/\block\b/g, 'const');

    // 6. Output & End
    code = code.replace(/\boutput\b/g, 'console.log');
    code = code.replace(/\bend\s*\(([^)]*)\)\s*;/g, '__end__($1);');

    // 7. Input Handling (ask int n = "Prompt" -> n = parseInt(prompt("Prompt")))
    code = code.replace(/\bask\s+(int|float|str|string|bool)\s+(\w+)\s*=\s*`([^`]*)`/gi, (match, type, varName, promptText) => {
        return parseAsk(type, varName, promptText);
    });
    code = code.replace(/\bask\s+(int|float|str|string|bool)\s+(\w+)\s*=\s*"([^"]*)"/gi, (match, type, varName, promptText) => {
        return parseAsk(type, varName, promptText);
    });

    // 8. Booleans (Yes/No -> true/false)
    code = code.replace(/\byes\b/gi, 'true');
    code = code.replace(/\bno\b/gi, 'false');

    // 9. Loop Control & Error Handling
    code = code.replace(/\bstop\b/g, 'break');
    code = code.replace(/\bskip\b/g, 'continue');
    code = code.replace(/\battempt\b/g, 'try');
    code = code.replace(/\brescue\b/g, 'catch(e)');

    // 10. List Methods
    code = code.replace(/\.add\(/g, '.push(');
    code = code.replace(/\.len\(\)/g, '.length');

    // 11. C-style For Loop (for (int i = 0 , i <= 5 , i++))
    code = code.replace(/for\s*\(\s*(?:int\s+)?([a-zA-Z_]\w*)\s*=\s*([^,]+)\s*,\s*\1\s*(<=?|>=?|==|!=)\s*([^,]+)\s*,\s*\1(\+\+|--)\s*\)/g, 
        'for (let $1 = $2; $1 $3 $4; $1$5)');

    // 12. PyCJ Range Loop (for i in range(1, 5) -> for(let i=1; i<=5; i++))
    code = code.replace(/for\s+([a-zA-Z_]\w*)\s+in\s+range\s*\(\s*([^,)]+)\s*,\s*([^,)]+)\s*\)/g, 
        'for (let $1 = $2; $1 <= $3; $1++)');

    // 13. Repeat...Until (do { ... } while(!(cond)))
    code = code.replace(/\brepeat\s*\{/g, 'do {');
    code = code.replace(/\buntil\s+(.*?)(?=\n)/g, 'while (!($1));');

    // 14. Ternary Operator (if cond then val1 else val2 -> (cond) ? val1 : val2)
    code = code.replace(/\bif\s+(.*?)\s+then\s+(.*?)\s+else\s+(.*?)(?=[;\n\)\],])/g, '(($1) ? ($2) : ($3))');

    // 15. Match Statement Translation
    code = translateMatchStatements(code);

    // 16. Translate 'else if' to 'else if' (JS supports it natively, just need to ensure spacing)
    code = code.replace(/\belse\s+if\b/g, 'else if');

    // 17. Ensure standalone blocks have semicolons if needed (JS auto-inserts, but good practice)
    return code;
}

function parseAsk(type, varName, promptText) {
    type = type.toLowerCase();
    if (type === 'int') return `${varName} = parseInt(prompt("${promptText}"))`;
    if (type === 'float') return `${varName} = parseFloat(prompt("${promptText}"))`;
    if (type === 'bool') return `${varName} = (prompt("${promptText}").toLowerCase() === 'yes')`;
    return `${varName} = prompt("${promptText}")`;
}

function translateMatchStatements(code) {
    let lines = code.split('\n');
    let newLines = [];
    let inMatch = false;
    let matchVar = "";
    let matchDepth = 0;
    let firstCase = true;

    for (let line of lines) {
        let stripped = line.trim();
        
        if (inMatch) {
            let opens = (line.match(/{/g) || []).length;
            let closes = (line.match(/}/g) || []).length;
            
            let caseMatch = line.match(/^(\s*)([^\s}].*?)\s*\{/);
            if (caseMatch) {
                let indent = caseMatch[1];
                let val = caseMatch[2].trim();
                
                if (val.toLowerCase() === 'else') {
                    newLines.push(line.replace(/^(\s*)(.*?)\s*\{/, '$1else {'));
                } else {
                    if (firstCase) {
                        newLines.push(line.replace(/^(\s*)(.*?)\s*\{/, `$1if (${matchVar} == ${val}) {`));
                        firstCase = false;
                    } else {
                        newLines.push(line.replace(/^(\s*)(.*?)\s*\{/, `$1else if (${matchVar} == ${val}) {`));
                    }
                }
                matchDepth += (opens - closes);
                continue;
            } else {
                matchDepth += (opens - closes);
                if (matchDepth <= 0) inMatch = false;
                newLines.push(line);
                continue;
            }
        }
        
        let matchStart = line.match(/^(\s*)match\s+(.+?)\s*\{/i);
        if (matchStart) {
            inMatch = true;
            matchVar = matchStart[2].trim();
            matchDepth = 1;
            firstCase = true;
            newLines.push(matchStart[1] + 'if (true) {');
            continue;
        }
        newLines.push(line);
    }
    return newLines.join('\n');
}

// Execution Environment
window.runPyCJ = function(pycjCode) {
    let jsCode = window.compilePyCJ(pycjCode);
    let output = "";
    let exitCode = 0;
    
    const customConsole = {
        log: function(...args) {
            let str = args.map(a => {
                if (typeof a === 'object' && a !== null) return JSON.stringify(a);
                return String(a);
            }).join(' ');
            output += str + '\n';
        }
    };

    const __end__ = (code) => { 
        throw { isEnd: true, code: code || 0 }; 
    };

    try {
        const func = new Function('console', '__end__', jsCode);
        func(customConsole, __end__);
    } catch (e) {
        if (e.isEnd) {
            exitCode = e.code;
        } else {
            // Clean up JS error messages to look like PyCJ errors
            let errMsg = e.message;
            if (errMsg.includes("is not defined")) {
                errMsg = errMsg.replace(" is not defined", " is not defined (Check for missing variables or typos)");
            }
            output += `PyCJ Runtime Error: ${errMsg}\n`;
            exitCode = 1;
        }
    }
    
    return { output: output.trim(), exitCode: exitCode, debug_js: jsCode };
}