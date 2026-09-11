// Fails on any declaration or function return without a written type.
// Counts an annotation, a type argument, a satisfies clause, a cast or a typed arrow as written.

import { readFile, readdir } from "node:fs/promises";
import { join, extname } from "node:path";

const ROOTS = ["src", "test"];
const IGNORE = new Set(["node_modules", "dist"]);

async function walk(dir) {
  const found = [];
  for (const item of await readdir(dir, { withFileTypes: true })) {
    if (IGNORE.has(item.name)) continue;
    const path = join(dir, item.name);
    if (item.isDirectory()) found.push(...(await walk(path)));
    else if ([".ts", ".tsx"].includes(extname(item.name))) found.push(path);
  }
  return found;
}

// Reads forward until brackets balance, so a trailing `satisfies` is still seen.
function statementFrom(lines, start) {
  let depth = 0;
  const collected = [];
  for (let index = start; index < lines.length && index < start + 600; index++) {
    const line = lines[index] ?? "";
    collected.push(line);
    for (const character of line) {
      if ("([{".includes(character)) depth++;
      else if (")]}".includes(character)) depth--;
    }
    if (depth <= 0 && /[;,]\s*$/.test(line)) break;
  }
  return collected.join("\n");
}

// Balances parens, because both parameters and return types can contain braces.
function signatureFrom(lines, start) {
  let depth = 0;
  let opened = false;
  let text = "";
  for (let index = start; index < lines.length && index < start + 40; index++) {
    const line = lines[index] ?? "";
    for (const character of line) {
      text += character;
      if (character === "(") {
        depth++;
        opened = true;
      } else if (character === ")") {
        depth--;
      }
    }
    text += "\n";
    if (opened && depth === 0) {
      // include what follows the closing paren on the same and next line
      return text + (lines[index + 1] ?? "");
    }
  }
  return text;
}

const DECLARATION = /^\s*(?:export\s+)?(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=/;
const ANNOTATED = /^\s*(?:export\s+)?(?:const|let)\s+[A-Za-z_$][\w$]*\s*:/;
const FUNCTION_DECL =
  /^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/;

const SELF_TYPED = [
  /^new\s+[\w.]+</, //                      new Set<string>()
  /^[\w.]+<[^=]*>\s*\(/, //                 parse<Shape>(...)
  /\bsatisfies\s+[A-Z]/, //                 { ... } satisfies Shape
  /\bas\s+[A-Z][\w<>[\].|\s]*[;,)]?\s*$/, //  ... as Shape
  /\)\s*:\s*[\w{([]/, //                    (x: number): string => ...
];

let failures = 0;

for (const root of ROOTS) {
  for (const file of await walk(root)) {
    const lines = (await readFile(file, "utf8")).split("\n");

    lines.forEach((line, index) => {
      const declaration = DECLARATION.exec(line);
      if (declaration && !ANNOTATED.test(line)) {
        const statement = statementFrom(lines, index);
        const expression = statement.slice(statement.indexOf("=") + 1).trim();
        if (!SELF_TYPED.some((pattern) => pattern.test(expression))) {
          console.log(`  ${file}:${index + 1}  ${declaration[1]} has no written type`);
          failures++;
        }
      }

      const declared = FUNCTION_DECL.exec(line);
      if (declared && !/\)\s*:\s*\S/.test(signatureFrom(lines, index))) {
        console.log(`  ${file}:${index + 1}  ${declared[1]}() has no return type`);
        failures++;
      }
    });
  }
}

if (failures > 0) {
  console.error(
    `\n${failures} declaration(s) rely on inference. Write the type down.`,
  );
  process.exit(1);
}
console.log("  every declaration and function return carries a written type");
