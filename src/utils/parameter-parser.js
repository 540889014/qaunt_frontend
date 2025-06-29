export const parseStrategyParameters = (code) => {
  const params = [];
  let match;

  // 1. Auto-detect strategy params from class attributes
  const classBodyRegex = /class\s+Strategy[\s\S]*?:([\s\S]*?)^\s*def\s+/m;
  const bodyMatch = code.match(classBodyRegex);
  
  if (bodyMatch) {
    const body = bodyMatch[1];
    const paramRegex = /^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*([0-9.-]+|'[^']*'|"[^"]*")/gm;
    while ((match = paramRegex.exec(body)) !== null) {
      const key = match[1];
      // Strip quotes from string values
      const value = match[2].replace(/^['"]|['"]$/g, '');
      if (!['exchange', 'symbols'].includes(key)) {
        params.push({
          name: key,
          defaultValue: value,
          dataType: 'STRING', // Default, user can change
          direction: 'IN',   // Default, user can change
        });
      }
    }
  }
  
  // 2. Fallback to @param annotations
  const paramAnnotationRegex = /@param\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*([0-9.-]+|'[^']*'|"[^"]*")/g;
  while ((match = paramAnnotationRegex.exec(code)) !== null) {
    const key = match[1];
    const value = match[2].replace(/^['"]|['"]$/g, '');
    // Avoid duplicates
    if (!params.some(p => p.name === key)) {
      params.push({
        name: key,
        defaultValue: value,
        dataType: 'STRING',
        direction: 'IN',
      });
    }
  }

  return params;
}; 