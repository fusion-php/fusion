import recast from "recast";
import babelParser from "recast/parsers/babel.js";

const {namedTypes: n, builders: b} = recast.types;

export default function injector(code, fileName, keys) {
  // Parse the source code using Babel's parser.
  const ast = recast.parse(code, {
    parser: babelParser,
    sourceFileName: fileName
  });

  // 1. Determine the local name for useFusion.
  let fusionLocalName = null;
  let foundUseFusionImport = false;
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
        path.node.source.value = "__aliasedFusionPath__";
        foundUseFusionImport = true;
      }
      this.traverse(path);
    }
  });
  if (!foundUseFusionImport) {
    fusionLocalName = "useFusion";
    const fusionImport = b.importDeclaration(
      [b.importSpecifier(b.identifier("useFusion"), b.identifier("useFusion"))],
      b.literal("__aliasedFusionPath__")
    );
    // Insert at the beginning of the file.
    ast.program.body.unshift(fusionImport);
  }

  // 2. Rewrite the default export:
  //    Replace "export default <expr>;" with "const __default__ = <expr>;"
  recast.types.visit(ast, {
    visitExportDefaultDeclaration(path) {
      const defaultIdentifier = b.identifier("__default__");
      const varDecl = b.variableDeclaration("const", [
        b.variableDeclarator(defaultIdentifier, path.node.declaration)
      ]);
      // Preserve comments attached to the export default.
      varDecl.comments = path.node.comments;
      path.replace(varDecl);
      return false;
    }
  });

  // 3. Append a statement to override the setup function.
  //    __default__.setup = function(props) {
  //      return <fusionLocalName>([__exportedKeysAsQuotedCsv__], props.fusion);
  //    };
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
              b.arrayExpression([b.identifier("__exportedKeysAsQuotedCsv__")]),
              b.memberExpression(b.identifier("props"), b.identifier("fusion"))
            ])
          )
        ])
      )
    )
  );

  // 4. Append an export default statement.
  const exportDefault = b.exportDefaultDeclaration(b.identifier("__default__"));
  ast.program.body.push(setupAssignment, exportDefault);

  // 5. Print the transformed AST back to code.
  const output = recast.print(ast, {
    quote: "double",
    sourceMapName: fileName || "transformed.js"
  });

  return {code: output.code, map: output.map};
}

export {injector};