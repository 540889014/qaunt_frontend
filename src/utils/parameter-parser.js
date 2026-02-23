/**
 * Parses strategy parameters from a readable stream of a Python script file.
 * This approach is memory-efficient and suitable for large files, as it
 * processes the file chunk by chunk without loading it all into memory.
 *
 * @param {ReadableStream} stream The file stream from a File object.
 * @param {string} language 'PYTHON' or 'JAVA' (defaults to 'PYTHON' if inferred)
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of parameter objects.
 */
export async function parseStrategyParametersStream(stream, language = 'PYTHON') {
  console.log(`[Parser] Starting stream parsing for ${language}...`);
  const params = [];
  const seenParams = new Set();
  const reader = stream.getReader();
  const decoder = new TextDecoder('utf-8');
  let inClassBody = false;
  let leftover = ''; 

  // --- Python Regex ---
  const PY_LITERAL_RE_SRC = "([+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:[eE][+-]?\\d+)?|True|False|None|'[^']*'|\"[^\"]*\")";
  const PY_CLASS_TYPED_ASSIGN_RE = new RegExp(`^([a-zA-Z_][a-zA-Z0-9_]*)\\s*:\\s*([^=]+?)\\s*=\\s*${PY_LITERAL_RE_SRC}\\s*(?:#.*)?$`);
  const PY_CLASS_ASSIGN_RE = new RegExp(`^([a-zA-Z_][a-zA-Z0-9_]*)\\s*=\\s*${PY_LITERAL_RE_SRC}\\s*(?:#.*)?$`);
  const PY_ANNOTATION_RE = new RegExp(`@param\\s+([a-zA-Z_][a-zA-Z0-9_]*)(?:\\s*:\\s*([^=]+?))?\\s*=\\s*${PY_LITERAL_RE_SRC}`);

  // --- Java Regex ---
  // Matches: private int windowSize = 20; or private double val = 1.0;
  // Group 1: Type, Group 2: Name, Group 3: Value
  const JAVA_FIELD_RE = /^\s*private\s+(int|double|float|long|String|boolean)\s+([a-zA-Z0-9_]+)\s*=\s*(.+?);/;

  const shouldIgnoreKey = (key) => {
    if (!key) return true;
    if (key.startsWith('_')) return true;
    if (language === 'PYTHON' && ['exchange', 'symbols'].includes(key)) return true;
    return false;
  };

  const normalizeLiteral = (raw, lang) => {
    if (raw == null) return '';
    const s = String(raw).trim();
    
    // String quotes removal
    if ((s.startsWith("'") && s.endsWith("'")) || (s.startsWith('"') && s.endsWith('"'))) {
      return s.slice(1, -1);
    }

    if (lang === 'PYTHON') {
        if (s === 'True') return 'true';
        if (s === 'False') return 'false';
        if (s === 'None') return '';
    } else {
        // Java
        if (s === 'true') return 'true';
        if (s === 'false') return 'false';
        if (s === 'null') return '';
    }
    return s;
  };

  const inferDataType = (typeHint, rawLiteral, lang) => {
    const th = (typeHint || '').toLowerCase().trim();
    const lit = String(rawLiteral || '').trim();

    if (lang === 'JAVA') {
        if (th === 'int' || th === 'long') return 'INT';
        if (th === 'double' || th === 'float') return 'DOUBLE';
        if (th === 'boolean') return 'BOOLEAN';
        if (th === 'string') return 'STRING';
        // Fallback to literal inference if typeHint is missing (unlikely for Java regex)
    }

    // Python / Generic inference
    if (th.includes('bool')) return 'BOOLEAN';
    if (th.includes('int')) return 'INT';
    if (th.includes('float') || th.includes('double') || th.includes('decimal')) return 'DOUBLE';
    if (th.includes('str') || th.includes('string')) return 'STRING';

    if (lit === 'True' || lit === 'False' || lit === 'true' || lit === 'false') return 'BOOLEAN';
    if ((lit.startsWith("'") && lit.endsWith("'")) || (lit.startsWith('"') && lit.endsWith('"'))) return 'STRING';
    
    if (/[.eE]/.test(lit)) return 'DOUBLE';
    if (/^-?\d+$/.test(lit)) return 'INT';
    
    return 'STRING'; // Default
  };

  try {
    let chunkIndex = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        if (leftover) processLine(leftover);
        break;
      }
      const chunk = decoder.decode(value, { stream: true });
      const lines = (leftover + chunk).split('\n');
      leftover = lines.pop() || '';
      for (const line of lines) processLine(line);
      chunkIndex++;
    }
  } finally {
    reader.releaseLock();
  }
  
  function processLine(line) {
    const trimmedLine = line.trim();
    if (!trimmedLine) return;

    if (language === 'PYTHON') {
        if (/class\s+Strategy/.test(trimmedLine)) {
            inClassBody = true;
            return;
        }
        if (inClassBody && /^\s*def\s+/.test(trimmedLine)) {
            inClassBody = false;
        }

        if (inClassBody) {
            const typedMatch = trimmedLine.match(PY_CLASS_TYPED_ASSIGN_RE);
            if (typedMatch) {
                const key = typedMatch[1];
                const annotation = typedMatch[2];
                const rawValue = typedMatch[3];
                addParam(key, rawValue, annotation);
                return;
            }
            const assignMatch = trimmedLine.match(PY_CLASS_ASSIGN_RE);
            if (assignMatch) {
                const key = assignMatch[1];
                const rawValue = assignMatch[2];
                addParam(key, rawValue, null);
                return;
            }
        }
        
        // Python Annotation fallback
        const annotationMatch = trimmedLine.match(PY_ANNOTATION_RE);
        if (annotationMatch) {
             addParam(annotationMatch[1], annotationMatch[3], annotationMatch[2]);
        }
        
    } else {
        // JAVA parsing
        // We look for private fields. We don't track class body strictly, assuming Strategy file structure.
        const fieldMatch = trimmedLine.match(JAVA_FIELD_RE);
        if (fieldMatch) {
            const type = fieldMatch[1];
            const key = fieldMatch[2];
            const rawValue = fieldMatch[3];
            // Filter out non-params like loggers, etc if they match (unlikely with int/double types)
            addParam(key, rawValue, type);
        }
    }
  }

  function addParam(key, rawValue, typeHint) {
    if (!shouldIgnoreKey(key) && !seenParams.has(key)) {
        params.push({
            name: key,
            defaultValue: normalizeLiteral(rawValue, language),
            dataType: inferDataType(typeHint, rawValue, language),
            direction: 'IN',
        });
        seenParams.add(key);
    }
  }

  return params;
}

/**
 * Parses the number of legs from a strategy script's content.
 * Supports Python and Java strategies.
 * Python: Explicit `self.leg1`, `self.leg2` or implicit args in `on_receive_ohlc(self, ohlc1, ohlc2)`.
 * Java: pairSymbol / pairReader / second BarJBinReader or JBinReader → 2 legs; else 1.
 *
 * @param {string} scriptContent The full content of the strategy script.
 * @param {string} [language] 'PYTHON' | 'JAVA'. If omitted, Python rules are used.
 * @returns {number} The number of legs detected.
 */
export function parseNumLegsFromScript(scriptContent, language = 'PYTHON') {
  if (!scriptContent) {
    return 0;
  }

  const lang = (language || 'PYTHON').toUpperCase();

  if (lang === 'JAVA') {
    // Java: 2 legs if strategy uses a pair (pairSymbol, pairReader, or second reader)
    if (/\bpairSymbol\b/.test(scriptContent) || /\bpairReader\b/.test(scriptContent)) return 2;
    if (/\bBarJBinReader\b.*\bBarJBinReader\b/s.test(scriptContent) || /\bJBinReader\b.*\bJBinReader\b/s.test(scriptContent)) return 2;
    if (/\bPairsTrading\w*\b/i.test(scriptContent) || /pair\s*[sS]ymbol/i.test(scriptContent)) return 2;
    return 1;
  }

  // --- Python ---
  // Strategy 1: Explicit `self.legX` definitions
  const legMatches = scriptContent.match(/\bself\.leg(\d+)\b/g);
  if (legMatches && legMatches.length > 0) {
    let maxLeg = 0;
    for (const match of legMatches) {
      const legNum = parseInt(match.match(/\d+/)[0], 10);
      if (legNum > maxLeg) {
        maxLeg = legNum;
      }
    }
    return maxLeg;
  }

  // Strategy 2: Implicitly from function arguments if self.legX is not found
  // Handle both single-line and multi-line function definitions
  const lines = scriptContent.split(/\r?\n/);
  let maxLegsFromArgs = 0;
  const lifecycleMethods = ['on_receive_ohlc', 'on_receive_marketdata'];

  for (let i = 0; i < lines.length; i++) {
    const trimmedLine = lines[i].trim();
    if (!trimmedLine.startsWith('def ')) continue;

    for (const methodName of lifecycleMethods) {
      if (trimmedLine.includes(methodName)) {
        // Check if function definition spans multiple lines
        let argsText = '';
        let parenStart = trimmedLine.indexOf('(');
        
        if (parenStart === -1) continue;
        
        // Extract initial part after opening parenthesis
        argsText = trimmedLine.substring(parenStart + 1);
        
        // If closing parenthesis is not on the same line, continue reading
        if (!argsText.includes(')')) {
          // Multi-line function definition - accumulate lines until we find closing paren
          for (let j = i + 1; j < lines.length; j++) {
            argsText += ' ' + lines[j].trim();
            if (lines[j].includes(')')) {
              break;
            }
          }
        }
        
        // Extract content between parentheses (remove closing paren and anything after)
        const closingParenIndex = argsText.indexOf(')');
        if (closingParenIndex !== -1) {
          argsText = argsText.substring(0, closingParenIndex);
        }
        
        if (argsText.trim()) {
          // Parse arguments: handle type hints, default values, and whitespace
          // Split by comma, extract parameter name (before : or =), trim whitespace
          const args = argsText
            .split(',')
            .map(arg => arg.trim().split(':')[0].split('=')[0].trim())
            .filter(arg => arg && arg !== 'self'); // Remove empty args and 'self'
          
          // For on_receive_ohlc and on_receive_marketdata callbacks,
          // all non-self arguments represent legs (e.g., o_ref, o1, o2 or md_ref, md1, md2)
          // Simply count all non-self arguments as legs
          const legCount = args.length;
          
          console.log(`[parseNumLegsFromScript] Found ${methodName} with ${legCount} legs:`, args);
          
          if (legCount > maxLegsFromArgs) {
            maxLegsFromArgs = legCount;
          }
        }
        break;
      }
    }
  }

  if (maxLegsFromArgs > 0) {
    console.log(`[parseNumLegsFromScript] Final leg count: ${maxLegsFromArgs}`);
    return maxLegsFromArgs;
  }
  
  // Fallback: If no legs found by either method, but there is content, assume 1 leg.
  const fallback = scriptContent.trim().length > 0 ? 1 : 0;
  console.log(`[parseNumLegsFromScript] No legs found (Python), using fallback: ${fallback}`);
  return fallback;
}