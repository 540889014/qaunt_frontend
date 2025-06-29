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
        // Process any remaining text
        if (leftover) {
          console.log('[Parser] Processing leftover line.');
          processLine(leftover);
        }
        break;
      }

      console.log(`[Parser] Received chunk ${chunkIndex} with size ${value.byteLength}.`);
      const chunk = decoder.decode(value, { stream: true });
      const lines = (leftover + chunk).split('\n');
      
      // The last line might be incomplete, so save it for the next chunk
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
    // Trim whitespace to correctly detect empty lines and content
    const trimmedLine = line.trim();
    if (!trimmedLine) return;

    // Check for start of the class
    if (/class\s+Strategy/.test(trimmedLine)) {
      inClassBody = true;
      return; // Continue to the next line
    }

    // Check for end of class attributes (start of a method)
    if (inClassBody && /^\s*def\s+/.test(trimmedLine)) {
      inClassBody = false;
      // Fall through to check for @param on the same line
    }

    // 1. Parse class attributes
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

    // 2. Parse @param annotations anywhere in the file
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