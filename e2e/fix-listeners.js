const fs = require('fs');
const path = require('path');

const e2eDir = __dirname;
const { total } = require(path.join(__dirname, 'pool-count.js'));

const files = fs.readdirSync(e2eDir).filter(f => f.endsWith('.spec.ts'));

// Snippet do listener de erro com filtro do eval() do Next dev mode
const newListener = `  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text().trim();
      // Next dev mode emite "eval() is not supported" do React — não é erro app.
      if (!text.startsWith("eval()") && !text.includes("Content-Security-Policy")) {
        errors.push(text);
      }
    }
  });`;

files.forEach(file => {
    const filePath = path.join(e2eDir, file);
    let content = fs.readFileSync(filePath, 'utf8');

    // Remove o pageerror handler (emite stack React dev, não é app error)
    content = content.replace(/  page\.on\("pageerror", \(err\) => errors\.push\(err\.message\)\);\n/g, '');

    // Substitui o console handler antigo pelo novo com filtro
    content = content.replace(
        /  page\.on\("console", \(msg\) => \{\n    if \(msg\.type\(\) === "error"\) errors\.push\(msg\.text\(\)\);\n  \}\);/g,
        newListener
    );

    fs.writeFileSync(filePath, content, 'utf8');
});

console.log('Listeners atualizados em todos os spec files.');
