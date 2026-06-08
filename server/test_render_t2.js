import fs from 'fs';

async function search() {
  const content = fs.readFileSync('templates.js', 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (line.includes('templateId === "2"')) {
      console.log(`Line ${idx + 1}: ${line.trim()}`);
    }
  });
}

search();
