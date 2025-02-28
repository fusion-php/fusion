import recast from "recast";
import ts from "recast/parsers/typescript.js";
import babel from "recast/parsers/babel.js";

const {namedTypes: n, builders: b} = recast.types;

export function optionsWithSetup(sourceCode, fileName = "", keys = []) {
  // Choose the appropriate parser.
  const parser =
    fileName.endsWith(".ts") || fileName.endsWith(".tsx") ? ts : babel;

  // Parse the source code.
  const ast = recast.parse(sourceCode, {
    parser,
    sourceFileName: fileName
  });

  // ------------------------------
  // Step 1: Remove any existing useFusion imports.
  recast.types.visit(ast, {
    visitImportDeclaration(path) {
      const specifiers = path.node.specifiers;
      if (
        specifiers &&
        specifiers.some(
          spec => n.ImportSpecifier.check(spec) && spec.imported.name === "useFusion"
        )
      ) {
        path.prune();
        return false;
      }
      this.traverse(path);
    }
  });

  // ------------------------------
  // Step 2: Find the default export (an object) and rewrite it as __default__.
  let defaultExportObject = null;
  recast.types.visit(ast, {
    visitExportDefaultDeclaration(path) {
      if (n.ObjectExpression.check(path.node.declaration)) {
        defaultExportObject = path.node.declaration;
        const defaultVarDecl = b.variableDeclaration("const", [
          b.variableDeclarator(b.identifier("__default__"), defaultExportObject)
        ]);
        path.replace(defaultVarDecl);
        return false;
      }
      this.traverse(path);
    }
  });
  if (!defaultExportObject) {
    throw new Error("Default export is not an object expression.");
  }

  // ------------------------------
  // Step 3: Locate the 'setup' property in __default__.
  let setupProperty = null;
  defaultExportObject.properties.forEach(prop => {
    const keyName =
      n.Identifier.check(prop.key)
        ? prop.key.name
        : n.Literal.check(prop.key)
          ? prop.key.value
          : null;
    if (keyName === "setup") {
      setupProperty = prop;
    }
  });
  if (!setupProperty) {
    throw new Error("No setup function found in default export.");
  }

  // If the setup property is an ObjectMethod, convert it into a normal property with a FunctionExpression.
  let setupFunctionNode = null;
  if (n.ObjectMethod && n.ObjectMethod.check(setupProperty)) {
    setupFunctionNode = b.functionExpression(
      null,
      setupProperty.params,
      setupProperty.body,
      setupProperty.generator,
      setupProperty.async
    );
    const newProp = b.property("init", setupProperty.key, setupFunctionNode);
    newProp.shorthand = false;
    const index = defaultExportObject.properties.indexOf(setupProperty);
    defaultExportObject.properties[index] = newProp;
    setupProperty = newProp;
  } else {
    setupFunctionNode = setupProperty.value;
  }

  // ------------------------------
  // Step 4: Traverse the setup() function body.
  // Update any useFusion calls and collect the keys used.
  const fusionUsedKeys = new Set();
  let foundUseFusionCall = false;
  recast.types.visit(setupFunctionNode, {
    visitCallExpression(path) {
      if (
        n.Identifier.check(path.node.callee) &&
        path.node.callee.name === "useFusion"
      ) {
        foundUseFusionCall = true;
        if (path.node.arguments.length === 0) {
          // No arguments passed: inject provided keys.
          const newArray = b.arrayExpression(keys.map(key => b.literal(key)));
          // Mark all keys as used.
          keys.forEach(key => fusionUsedKeys.add(key));
          path.node.arguments.push(newArray);
        } else {
          // There is at least one argument.
          const origArg = path.node.arguments[0];
          if (n.ArrayExpression.check(origArg)) {
            if (origArg.elements.length > 0) {
              // Non-empty array: collect the keys.
              origArg.elements.forEach(elem => {
                if (n.Literal.check(elem) && typeof elem.value === "string") {
                  fusionUsedKeys.add(elem.value);
                }
              });
            }
            // Else: explicitly passed empty array—leave it as-is.
          }
        }
        // In all cases, update the call to add a second parameter.
        path.node.arguments = [
          path.node.arguments[0],
          b.logicalExpression(
            "||",
            b.memberExpression(b.identifier("__fusionProvidedProps"), b.identifier("fusion")),
            b.objectExpression([])
          )
        ];
      }
      this.traverse(path);
    }
  });
  const usedKeysArray = foundUseFusionCall ? Array.from(fusionUsedKeys) : [];
  const missingKeys = keys.filter(key => !usedKeysArray.includes(key));

  // ------------------------------
  // Step 5: Insert a top-level declaration for __fusionProvidedProps.
  const fusionPropsDecl = b.variableDeclaration("let", [
    b.variableDeclarator(b.identifier("__fusionProvidedProps"), null)
  ]);
  ast.program.body.unshift(fusionPropsDecl);

  // ------------------------------
  // Step 6: Insert a new import for useFusion.
  let lastImportIndex = -1;
  ast.program.body.forEach((node, idx) => {
    if (n.ImportDeclaration.check(node)) {
      lastImportIndex = idx;
    }
  });
  const fusionImport = b.importDeclaration(
    [b.importSpecifier(b.identifier("useFusion"))],
    b.literal("__aliasedFusionPath__")
  );
  ast.program.body.splice(lastImportIndex + 1, 0, fusionImport);

  // ------------------------------
  // Step 7: Append a wrapper to override the setup function.
  // If a useFusion call exists, then missingKeys (the keys not handled inside setup) are used;
  // otherwise, all provided keys are used.
  const missingKeysForWrapper = foundUseFusionCall ? missingKeys : keys;
  let fusionDataDecl;
  if (missingKeysForWrapper.length === 0) {
    fusionDataDecl = b.variableDeclaration("const", [
      b.variableDeclarator(b.identifier("fusionData"), b.objectExpression([]))
    ]);
  } else {
    const missingArrayExpr = b.arrayExpression(
      missingKeysForWrapper.map(key => b.literal(key))
    );
    const fusionDataCall = b.callExpression(b.identifier("useFusion"), [
      missingArrayExpr,
      b.logicalExpression(
        "||",
        b.memberExpression(b.identifier("props"), b.identifier("fusion")),
        b.objectExpression([])
      )
    ]);
    fusionDataDecl = b.variableDeclaration("const", [
      b.variableDeclarator(b.identifier("fusionData"), fusionDataCall)
    ]);
  }
  const userReturnsDecl = b.variableDeclaration("let", [
    b.variableDeclarator(
      b.identifier("userReturns"),
      b.conditionalExpression(
        b.binaryExpression(
          "===",
          b.unaryExpression("typeof", b.identifier("userSetup"), true),
          b.literal("function")
        ),
        b.callExpression(b.identifier("userSetup"), [
          b.identifier("props"),
          b.identifier("ctx")
        ]),
        b.objectExpression([])
      )
    )
  ]);
  const newSetupBody = b.blockStatement([
    b.expressionStatement(
      b.assignmentExpression("=", b.identifier("__fusionProvidedProps"), b.identifier("props"))
    ),
    fusionDataDecl,
    userReturnsDecl,
    b.returnStatement(
      b.objectExpression([
        b.spreadElement(b.identifier("fusionData")),
        b.spreadElement(b.identifier("userReturns"))
      ])
    )
  ]);
  const newSetupFunc = b.functionExpression(null, [b.identifier("props"), b.identifier("ctx")], newSetupBody);
  const userSetupDecl = b.variableDeclaration("const", [
    b.variableDeclarator(
      b.identifier("userSetup"),
      b.memberExpression(b.identifier("__default__"), b.identifier("setup"))
    )
  ]);
  const setupOverride = b.expressionStatement(
    b.assignmentExpression(
      "=",
      b.memberExpression(b.identifier("__default__"), b.identifier("setup")),
      newSetupFunc
    )
  );
  const exportDefaultDecl = b.exportDefaultDeclaration(b.identifier("__default__"));
  ast.program.body.push(userSetupDecl, setupOverride, exportDefaultDecl);

  // ------------------------------
  // Generate output.
  const output = recast.print(ast, {
    quote: "double",
    sourceMapName: fileName || "transformed.js"
  });
  return {code: output.code, map: output.map, remaining: missingKeys};
}

export default optionsWithSetup;