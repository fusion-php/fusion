import babelParser from "recast/parsers/babel.js";
import {
  handleFusionImport,
  ensureFusionImport,
  extractDefaultExport,
  createDefaultExport,
  generateCode
} from "./ast-utils.js";
import recast from "recast";

const {builders: b} = recast.types;

export default function injector(code, fileName, keys) {
  // Parse the source code using Babel's parser.
  const ast = recast.parse(code, {
    parser: babelParser,
    sourceFileName: fileName
  });

  // 1. Determine the local name for useFusion.
  const {fusionLocalName: localName, hasUseFusionImport} = handleFusionImport(ast);
  const fusionLocalName = localName || ensureFusionImport(ast, hasUseFusionImport) || "useFusion";

  // 2. Rewrite the default export:
  extractDefaultExport(ast);

  // 3. Append a statement to override the setup function.
  const setupAssignment = b.expressionStatement(
    b.assignmentExpression(
      "=",
      b.memberExpression(b.identifier("__default__"), b.identifier("setup")),
      b.functionExpression(
        null,
        [b.identifier("props")],
        b.blockStatement([
          b.returnStatement(
            b.callExpression(b.identifier(fusionLocalName), [
              b.arrayExpression(keys.map(key => b.literal(key))),
              b.memberExpression(b.identifier("props"), b.identifier("fusion"))
            ])
          )
        ])
      )
    )
  );

  // 4. Append an export default statement.
  const exportDefault = createDefaultExport();
  ast.program.body.push(setupAssignment, exportDefault);

  // 5. Print the transformed AST back to code.
  const output = generateCode(ast, fileName);

  return {code: output.code, map: output.map};
}

export {injector};