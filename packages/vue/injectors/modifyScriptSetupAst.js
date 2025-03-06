import {
  parseCode,
  handleFusionImport,
  ensureFusionImport,
  collectKeysFromFusionCalls,
  createFusionCall,
  generateCode
} from "./ast-utils.js";
import recast from "recast";

const {builders: b} = recast.types;

export function transformCode(sourceCode, fileName = "", keys = []) {
  // Parse the source code into an AST
  const ast = parseCode(sourceCode, fileName);

  // Handle imports and get fusion local name
  const {fusionLocalName: localName, hasUseFusionImport} = handleFusionImport(ast);
  const fusionLocalName = localName || (hasUseFusionImport ? localName : "useFusion");

  // Collect keys from existing useFusion calls and update them to include __props.fusion
  const {
    foundUseFusionCall,
    usedKeys
  } = collectKeysFromFusionCalls(ast, fusionLocalName || "useFusion", "__props.fusion");

  // Compute the missing keys (if any)
  const missingKeys = keys.filter(key => !usedKeys.has(key));

  // Two main injection strategies:
  if (foundUseFusionCall) {
    // Case 1: At least one useFusion call exists.
    // If any keys are missing, inject a new useFusion call for them.
    if (missingKeys.length > 0) {
      // Ensure the import exists.
      if (!hasUseFusionImport) {
        ensureFusionImport(ast, hasUseFusionImport);
      }

      // Find the index after the last import.
      let lastImportIndex = -1;
      for (let i = 0; i < ast.program.body.length; i++) {
        if (ast.program.body[i].type === "ImportDeclaration") {
          lastImportIndex = i;
        }
      }

      // Build a variable declaration:
      const properties = missingKeys.map(key =>
        b.property("init", b.identifier(key), b.identifier(key), false, false)
      );
      const objectPattern = b.objectPattern(properties);
      const callExpr = createFusionCall(fusionLocalName || "useFusion", missingKeys, "__props.fusion");
      const varDecl = b.variableDeclaration("const", [
        b.variableDeclarator(objectPattern, callExpr)
      ]);

      // Insert the new declaration after the last import.
      ast.program.body.splice(lastImportIndex + 1, 0, varDecl);
    }
  } else {
    // Case 2: No useFusion call exists.
    // Ensure an import for useFusion is injected.
    if (!hasUseFusionImport) {
      ensureFusionImport(ast, hasUseFusionImport);
    }

    // Find the index after the last import.
    let lastImportIndex = -1;
    for (let i = 0; i < ast.program.body.length; i++) {
      if (ast.program.body[i].type === "ImportDeclaration") {
        lastImportIndex = i;
      }
    }

    // Insert a call that returns { data } using all provided keys.
    const callExpr = createFusionCall(fusionLocalName || "useFusion", keys, "__props.fusion");
    const varDecl = b.variableDeclaration("const", [
      // We destructure "data" as the default property.
      b.variableDeclarator(
        b.objectPattern([b.property("init", b.identifier("data"), b.identifier("data"), false, false)]),
        callExpr
      )
    ]);

    ast.program.body.splice(lastImportIndex + 1, 0, varDecl);
    // In this branch, all keys are handled.
    missingKeys.length = 0;
  }

  // Generate the output code with a source map.
  const output = generateCode(ast, fileName);

  return {code: output.code, map: output.map, remaining: missingKeys};
}

export default transformCode;