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
      const paramMatch = trimmedLine.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*([0-9.-]+|'[^']*'|"[^"]*")/);
      if (paramMatch) {
        const key = paramMatch[1];
        if (!['exchange', 'symbols'].includes(key) && !seenParams.has(key)) {
          const value = paramMatch[2].replace(/^['"]|['"]$/g, '');
          params.push({ name: key, defaultValue: value, dataType: 'STRING', direction: 'IN' });
          seenParams.add(key);
        }
      }
    }

    const annotationMatch = trimmedLine.match(/@param\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*([0-9.-]+|'[^']*'|"[^"]*")/);
    if (annotationMatch) {
      const key = annotationMatch[1];
      if (!seenParams.has(key)) {
        const value = annotationMatch[2].replace(/^['"]|['"]$/g, '');
        params.push({ name: key, defaultValue: value, dataType: 'STRING', direction: 'IN' });
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
  const lines = scriptContent.split(/\r?\n/);
  let maxLegsFromArgs = 0;
  const lifecycleMethods = ['on_receive_ohlc', 'on_receive_marketdata'];

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine.startsWith('def ')) continue;

    for (const methodName of lifecycleMethods) {
      if (trimmedLine.includes(methodName)) {
        // Correct regex to capture content within parentheses
        const argMatch = trimmedLine.match(/\((.*)\)/);
        if (argMatch && argMatch[1]) {
          const args = argMatch[1].split(',').map(arg => arg.trim().split(':')[0]);
          
          let currentLegs = 0;
          for (const arg of args) {
            if (arg !== 'self' && (arg.startsWith('ohlc') || arg.startsWith('md'))) {
              currentLegs++;
            }
          }
          if (currentLegs > maxLegsFromArgs) {
            maxLegsFromArgs = currentLegs;
          }
        }
        break;
      }
    }
  }

  if (maxLegsFromArgs > 0) {
    return maxLegsFromArgs;
  }
  
  // Fallback: If no legs found by either method, but there is content, assume 1 leg.
  return scriptContent.trim().length > 0 ? 1 : 0;
}