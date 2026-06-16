import fs from 'fs';

const filepath = 'src/components/UserManagement.tsx';
if (fs.existsSync(filepath)) {
  const content = fs.readFileSync(filepath, 'utf8');
  const lines = content.split('\n');
  const startLine = 770;
  const endLine = 1030;
  
  console.log('--- Simplified Auditing ---');
  let openBrackets = 0;
  let openParens = 0;
  let openDivs = 0;
  
  for (let i = startLine - 1; i < endLine; i++) {
    const line = lines[i];
    if (line === undefined) break;
    
    const divsOpened = line.split('<div').length - 1;
    const divsClosed = line.split('</div>').length - 1;
    const parensOpened = line.split('(').length - 1;
    const parensClosed = line.split(')').length - 1;
    const bracesOpened = line.split('{').length - 1;
    const bracesClosed = line.split('}').length - 1;
    
    openDivs += divsOpened - divsClosed;
    openParens += parensOpened - parensClosed;
    openBrackets += bracesOpened - bracesClosed;
    
    console.log(
      (i + 1) + ': ' + line.trim().substring(0, 45) + 
      ' | Divs: ' + openDivs + 
      ' | Parens: ' + openParens + 
      ' | Braces: ' + openBrackets
    );
  }
} else {
  console.log('File not found');
}
