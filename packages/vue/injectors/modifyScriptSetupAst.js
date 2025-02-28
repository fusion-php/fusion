import recast from "recast";
import ts from "recast/parsers/typescript.js";
import babel from "recast/parsers/babel.js";

const {namedTypes: n, builders: b} = recast.types;

export function transformCode(sourceCode, fileName = "", keys = []) {
  // Choose the appropriate parser based on the file extension.
  const parser =
    fileName.endsWith(".ts") || fileName.endsWith(".tsx")
      ? ts
      : babel;

  // Parse the source code into an AST, tagging it with the source file name.
  const ast = recast.parse(sourceCode, {parser, sourceFileName: fileName});

  let foundUseFusionCall = false;
  let hasUseFusionImport = false;
  // Will hold the local name (alias) of useFusion if imported.
  let fusionLocalName = null;
  const usedKeys = new Set();

  // Traverse the AST to update the import and any useFusion calls.
  recast.types.visit(ast, {
    // Update any import that includes a specifier with imported name "useFusion".
    visitImportDeclaration(path) {
      const specifiers = path.node.specifiers;
      if (specifiers && specifiers.some(spec => {
        return n.ImportSpecifier.check(spec) &&
          spec.imported &&
          spec.imported.name === "useFusion";
      })) {
        // Find the first specifier for useFusion and record its local name.
        specifiers.forEach(spec => {
          if (n.ImportSpecifier.check(spec) &&
            spec.imported &&
            spec.imported.name === "useFusion") {
            fusionLocalName = spec.local.name;
          }
        });
        // Update the import source to our alias.
        path.node.source.value = "__aliasedFusionPath__";
        hasUseFusionImport = true;
      }
      this.traverse(path);
    },
    // Update useFusion calls (if any) and collect the keys used.
    visitCallExpression(path) {
      // Check if the callee matches the local name for useFusion.
      if (
        n.Identifier.check(path.node.callee) &&
        path.node.callee.name === (fusionLocalName || "useFusion")
      ) {
        foundUseFusionCall = true;
        // If the first argument is an array literal, collect its string elements.
        if (
          path.node.arguments.length > 0 &&
          n.ArrayExpression.check(path.node.arguments[0])
        ) {
          const arrExpr = path.node.arguments[0];
          arrExpr.elements.forEach(element => {
            if (n.Literal.check(element) && typeof element.value === "string") {
              usedKeys.add(element.value);
            }
          });
        }
        // Update the call to useFusion:
        // Keep the original first argument (or an empty array if missing),
        // then add __props.fusion.
        const originalFirstArg =
          path.node.arguments.length > 0 ? path.node.arguments[0] : b.arrayExpression([]);
        path.node.arguments = [
          originalFirstArg,
          b.memberExpression(b.identifier("__props"), b.identifier("fusion"))
        ];
      }
      this.traverse(path);
    }
  });

  // Compute the missing keys (if any).
  let missingKeys = keys.filter(key => !usedKeys.has(key));

  // Two main injection strategies:
  if (foundUseFusionCall) {
    // Case 1: At least one useFusion call exists.
    // If any keys are missing, inject a new useFusion call for them.
    if (missingKeys.length > 0) {
      // Ensure the import exists.
      if (!hasUseFusionImport) {
        fusionLocalName = "useFusion";
        const importDeclaration = b.importDeclaration(
          [b.importSpecifier(b.identifier("useFusion"))],
          b.literal("__aliasedFusionPath__")
        );
        ast.program.body.unshift(importDeclaration);
        hasUseFusionImport = true;
      }
      // Find the index after the last import.
      let lastImportIndex = -1;
      for (let i = 0; i < ast.program.body.length; i++) {
        if (ast.program.body[i].type === "ImportDeclaration") {
          lastImportIndex = i;
        }
      }
      // Build a variable declaration:
      // const { key1, key2, ... } = <alias>(["key1", "key2", ...], __props.fusion);
      const properties = missingKeys.map(key =>
        b.property("init", b.identifier(key), b.identifier(key), false, false)
      );
      const objectPattern = b.objectPattern(properties);
      const arrayExpr = b.arrayExpression(missingKeys.map(key => b.literal(key)));
      const callExpr = b.callExpression(b.identifier(fusionLocalName || "useFusion"), [
        arrayExpr,
        b.memberExpression(b.identifier("__props"), b.identifier("fusion"))
      ]);
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
      fusionLocalName = "useFusion";
      const importDeclaration = b.importDeclaration(
        [b.importSpecifier(b.identifier("useFusion"))],
        b.literal("__aliasedFusionPath__")
      );
      ast.program.body.unshift(importDeclaration);
      hasUseFusionImport = true;
    }
    // In this case, inject a call that returns { data } using all provided keys.
    let lastImportIndex = -1;
    for (let i = 0; i < ast.program.body.length; i++) {
      if (ast.program.body[i].type === "ImportDeclaration") {
        lastImportIndex = i;
      }
    }
    const arrayExpr = b.arrayExpression(keys.map(key => b.literal(key)));
    const callExpr = b.callExpression(b.identifier(fusionLocalName || "useFusion"), [
      arrayExpr,
      b.memberExpression(b.identifier("__props"), b.identifier("fusion"))
    ]);
    const varDecl = b.variableDeclaration("const", [
      // We destructure "data" as the default property.
      b.variableDeclarator(
        b.objectPattern([b.property("init", b.identifier("data"), b.identifier("data"), false, false)]),
        callExpr
      )
    ]);
    ast.program.body.splice(lastImportIndex + 1, 0, varDecl);
    // In this branch, all keys are handled.
    missingKeys = [];
  }

  // Generate the output code with a source map.
  const output = recast.print(ast, {
    quote: "double",
    sourceMapName: fileName || "transformed.js"
  });

  return {code: output.code, map: output.map, remaining: missingKeys};
}

export default transformCode;