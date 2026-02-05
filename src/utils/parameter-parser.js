/**
 * Parses strategy parameters from a readable stream of a Python script file.
 * This approach is memory-efficient and suitable for large files, as it
 * processes the file chunk by chunk without loading it all into memory.
 *
 * @param {ReadableStream} stream The file stream from a File object.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of parameter objects.
 */
export async function parseStrategyParametersStream(stream) {
  console.log('[Parser] Starting stream parsing...');
  const params = [];
  const seenParams = new Set();
  const reader = stream.getReader();
  const decoder = new TextDecoder('utf-8');
  let inClassBody = false;
  let leftover = ''; // Holds incomplete lines from the end of a chunk

  // --- Helpers ---
  // Python literal subset we support for parameters (int/float/bool/None/str)
  const LITERAL_RE_SRC =
    "([+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:[eE][+-]?\\d+)?|True|False|None|'[^']*'|\"[^\"]*\")";
  const CLASS_TYPED_ASSIGN_RE = new RegExp(
    `^([a-zA-Z_][a-zA-Z0-9_]*)\\s*:\\s*([^=]+?)\\s*=\\s*${LITERAL_RE_SRC}\\s*(?:#.*)?$`
  );
  const CLASS_ASSIGN_RE = new RegExp(
    `^([a-zA-Z_][a-zA-Z0-9_]*)\\s*=\\s*${LITERAL_RE_SRC}\\s*(?:#.*)?$`
  );
  const ANNOTATION_RE = new RegExp(
    `@param\\s+([a-zA-Z_][a-zA-Z0-9_]*)(?:\\s*:\\s*([^=]+?))?\\s*=\\s*${LITERAL_RE_SRC}`
  );

  const shouldIgnoreKey = (key) => {
    // Ignore internal state vars and reserved framework keys
    if (!key) return true;
    if (key.startsWith('_')) return true;
    return ['exchange', 'symbols'].includes(key);
  };

  const normalizeLiteral = (raw) => {
    if (raw == null) return '';
    const s = String(raw).trim();
    if ((s.startsWith("'") && s.endsWith("'")) || (s.startsWith('"') && s.endsWith('"'))) {
      return s.slice(1, -1);
    }
    if (s === 'True') return 'true';
    if (s === 'False') return 'false';
    if (s === 'None') return '';
    return s;
  };

  const inferDataType = (annotation, rawLiteral) => {
    const ann = (annotation || '').toLowerCase().trim();
    if (ann.includes('bool')) return 'BOOLEAN';
    if (ann.includes('int')) return 'INT';
    if (ann.includes('float') || ann.includes('double') || ann.includes('decimal')) return 'DOUBLE';
    if (ann.includes('str') || ann.includes('string')) return 'STRING';

    const lit = String(rawLiteral || '').trim();
    if (lit === 'True' || lit === 'False') return 'BOOLEAN';
    if ((lit.startsWith("'") && lit.endsWith("'")) || (lit.startsWith('"') && lit.endsWith('"'))) return 'STRING';
    if (lit === 'None') return 'STRING';
    // numeric
    if (/[.eE]/.test(lit)) return 'DOUBLE';
    return 'INT';
  };

  try {
    let chunkIndex = 0;
    while (true) {
      console.log(`[Parser] Reading chunk ${chunkIndex}...`);
      const { done, value } = await reader.read();
      if (done) {
        console.log('[Parser] Stream finished.');
        if (leftover) {
          console.log('[Parser] Processing leftover line.');
          processLine(leftover);
        }
        break;
      }

      console.log(`[Parser] Received chunk ${chunkIndex} with size ${value.byteLength}.`);
      const chunk = decoder.decode(value, { stream: true });
      const lines = (leftover + chunk).split('\n');
      
      leftover = lines.pop() || '';

      for (const line of lines) {
        processLine(line);
      }
      chunkIndex++;
    }
  } finally {
    console.log('[Parser] Releasing stream lock.');
    reader.releaseLock();
  }
  
  function processLine(line) {
    const trimmedLine = line.trim();
    if (!trimmedLine) return;

    if (/class\s+Strategy/.test(trimmedLine)) {
      inClassBody = true;
      return;
    }

    if (inClassBody && /^\s*def\s+/.test(trimmedLine)) {
      inClassBody = false;
    }

    if (inClassBody) {
      // 1) Typed class var: `name: int = 1`
      const typedMatch = trimmedLine.match(CLASS_TYPED_ASSIGN_RE);
      if (typedMatch) {
        const key = typedMatch[1];
        const annotation = typedMatch[2];
        const rawValue = typedMatch[3];
        if (!shouldIgnoreKey(key) && !seenParams.has(key)) {
          params.push({
            name: key,
            defaultValue: normalizeLiteral(rawValue),
            dataType: inferDataType(annotation, rawValue),
            direction: 'IN',
          });
          seenParams.add(key);
        }
        return;
      }

      // 2) Untyped class var: `name = 1`
      const assignMatch = trimmedLine.match(CLASS_ASSIGN_RE);
      if (assignMatch) {
        const key = assignMatch[1];
        const rawValue = assignMatch[2];
        if (!shouldIgnoreKey(key) && !seenParams.has(key)) {
          params.push({
            name: key,
            defaultValue: normalizeLiteral(rawValue),
            dataType: inferDataType(null, rawValue),
            direction: 'IN',
          });
          seenParams.add(key);
        }
      }
    }

    // Optional: annotation-style params anywhere in file (legacy support)
    const annotationMatch = trimmedLine.match(ANNOTATION_RE);
    if (annotationMatch) {
      const key = annotationMatch[1];
      const annotation = annotationMatch[2];
      const rawValue = annotationMatch[3];
      if (!shouldIgnoreKey(key) && !seenParams.has(key)) {
        params.push({
          name: key,
          defaultValue: normalizeLiteral(rawValue),
          dataType: inferDataType(annotation, rawValue),
          direction: 'IN',
        });
        seenParams.add(key);
      }
    }
  }

  console.log('[Parser] Parsing complete, found params:', params);
  return params;
}

/**
 * Parses the number of legs from a strategy script's content.
 * It robustly handles two styles of leg definition:
 * 1. Explicit: `self.leg1`, `self.leg2`, etc.
 * 2. Implicit: Arguments in `on_receive_ohlc(self, ohlc1, ohlc2)`
 *
 * @param {string} scriptContent The full content of the Python script.
 * @returns {number} The number of legs detected.
 */
export function parseNumLegsFromScript(scriptContent) {
  if (!scriptContent) {
    return 0;
  }

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
  console.log(`[parseNumLegsFromScript] No legs found, using fallback: ${fallback}`);
  return fallback;
}