import recast from "recast";
import ts from "recast/parsers/typescript.js";
import babel from "recast/parsers/babel.js";

const {namedTypes: n, builders: b} = recast.types;

/**
 * Selects the appropriate parser based on typescript flag
 * @param {boolean} useTypeScript - Whether to use the TypeScript parser
 * @returns {object} The parser to use
 */
export function selectParser(useTypeScript) {
  return useTypeScript ? ts : babel;
}

/**
 * Parse source code into an AST
 * @param {string} sourceCode - Source code to parse
 * @param {string} fileName - File name (used for source mapping)
 * @param {boolean} useTypeScript - Whether to use the TypeScript parser
 * @returns {object} The resulting AST
 */
export function parseCode(sourceCode, fileName = "", useTypeScript = false) {
  const parser = selectParser(useTypeScript);
  return recast.parse(sourceCode, {
    parser,
    sourceFileName: fileName
  });
}

/**
 * Handles useFusion import in AST
 * @param {object} ast - The AST to modify
 * @param {string} fusionPath - The path to use for the fusion import
 * @returns {object} Object containing information about useFusion imports
 */
export function handleFusionImport(ast, fusionPath) {
  let fusionLocalName = null;
  let hasUseFusionImport = false;

  recast.types.visit(ast, {
    visitImportDeclaration(path) {
      const specifiers = path.node.specifiers;
      if (
        specifiers &&
        specifiers.some(
          spec =>
            n.ImportSpecifier.check(spec) &&
            spec.imported &&
            spec.imported.name === "useFusion"
        )
      ) {
        specifiers.forEach(spec => {
          if (n.ImportSpecifier.check(spec) && spec.imported.name === "useFusion") {
            fusionLocalName = spec.local.name;
          }
        });
        // Update the import source.
        path.node.source.value = fusionPath;
        hasUseFusionImport = true;
      }
      this.traverse(path);
    }
  });

  return {fusionLocalName, hasUseFusionImport};
}

/**
 * Adds a useFusion import if one doesn't exist
 * @param {object} ast - The AST to modify
 * @param {boolean} hasUseFusionImport - Whether a useFusion import already exists
 * @param {string} fusionPath - The path to use for the fusion import
 * @returns {string} The local name for useFusion (default is "useFusion")
 */
export function ensureFusionImport(ast, hasUseFusionImport, fusionPath) {
  if (!hasUseFusionImport) {
    const fusionImport = b.importDeclaration(
      [b.importSpecifier(b.identifier("useFusion"))],
      b.literal(fusionPath)
    );

    // Find the best position to insert the import (after other imports)
    let lastImportIndex = -1;
    for (let i = 0; i < ast.program.body.length; i++) {
      if (ast.program.body[i].type === "ImportDeclaration") {
        lastImportIndex = i;
      }
    }
    ast.program.body.splice(lastImportIndex + 1, 0, fusionImport);
    return "useFusion";
  }
  return null; // The calling code should use the existing fusionLocalName
}

/**
 * Creates a useFusion call expression
 * @param {string} fusionLocalName - The local name for useFusion
 * @param {string[]} keys - Keys to include in the useFusion call
 * @param {string} propsMember - The property access for fusion (e.g., "props.fusion")
 * @returns {object} The call expression node
 */
export function createFusionCall(fusionLocalName, keys, propsMember) {
  const arrayExpr = b.arrayExpression(keys.map(key => b.literal(key)));
  const fusionMemberExpr = b.memberExpression(
    b.identifier(propsMember.split('.')[0]),
    b.identifier(propsMember.split('.')[1])
  );

  return b.callExpression(b.identifier(fusionLocalName), [
    arrayExpr,
    fusionMemberExpr
  ]);
}

/**
 * Collects keys from existing useFusion calls and updates the calls to include props.fusion
 * @param {object} ast - The AST to traverse
 * @param {string} fusionLocalName - The local name for useFusion
 * @param {string} propsMember - The property access for fusion (e.g., "__props.fusion")
 * @returns {object} Object with foundUseFusionCall flag and set of keys
 */
export function collectKeysFromFusionCalls(ast, fusionLocalName, propsMember = "__props.fusion") {
  let foundUseFusionCall = false;
  const usedKeys = new Set();

  recast.types.visit(ast, {
    visitCallExpression(path) {
      if (
        n.Identifier.check(path.node.callee) &&
        path.node.callee.name === fusionLocalName
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

        // Update the call to include the props.fusion parameter
        const fusionMemberExpr = b.memberExpression(
          b.identifier(propsMember.split('.')[0]),
          b.identifier(propsMember.split('.')[1])
        );

        // Keep the original first argument or create an empty array if missing
        const firstArg = path.node.arguments.length > 0
          ? path.node.arguments[0]
          : b.arrayExpression([]);

        // Update arguments to include props.fusion
        path.node.arguments = [firstArg, fusionMemberExpr];
      }
      this.traverse(path);
    }
  });

  return {foundUseFusionCall, usedKeys};
}

/**
 * Generates code from AST with consistent print options
 * @param {object} ast - The AST to print
 * @param {string} fileName - File name for source map
 * @returns {object} Object with code and map
 */
export function generateCode(ast, fileName = "") {
  return recast.print(ast, {
    quote: "double",
    sourceMapName: fileName || "transformed.js"
  });
}

/**
 * Finds the default export and replaces it with a variable declaration
 * @param {object} ast - The AST to modify
 * @returns {object|null} The default export object or null if not found
 */
export function extractDefaultExport(ast) {
  let defaultExportObject = null;

  recast.types.visit(ast, {
    visitExportDefaultDeclaration(path) {
      defaultExportObject = path.node.declaration;
      const defaultVarDecl = b.variableDeclaration("const", [
        b.variableDeclarator(b.identifier("__default__"), defaultExportObject)
      ]);
      // Preserve comments attached to the export default.
      defaultVarDecl.comments = path.node.comments;
      path.replace(defaultVarDecl);
      return false;
    }
  });

  return defaultExportObject;
}

/**
 * Creates a new export default statement for __default__
 * @returns {object} The export default declaration node
 */
export function createDefaultExport() {
  return b.exportDefaultDeclaration(b.identifier("__default__"));
}