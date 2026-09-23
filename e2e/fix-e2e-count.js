const fs = require('fs');
const path = require('path');

const e2eDir = __dirname;
const { total } = require('./pool-count.js');

const files = fs.readdirSync(e2eDir).filter(f => f.endsWith('.spec.ts'));

console.log(`Updating ${files.length} e2e files to use dynamic count: ${total} (total)`);

files.forEach(file => {
    const filePath = path.join(e2eDir, file);
    let content = fs.readFileSync(filePath, 'utf8');

    content = content
        .replace(/(\s+)toHaveCount\(\s*7\s*\)/g, (match, spaces) => `${spaces}toHaveCount(${total})`)
        .replace(/(\s+)toHaveCount\(\s*8\s*\)/g, (match, spaces) => {
            // 8 = total - aluguel (venda = 53, aluguel = 56)
            return `${spaces}toHaveCount(${total - 56})`;
        })
        .replace(/test\(".*?7cards.*?/g, (match) => match.replace('7cards', 'ncards'));

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✓ Updated: ${file}`);
});

console.log('Done.');