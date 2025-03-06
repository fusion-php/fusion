import recast from "recast";
import babel from "recast/parsers/babel.js";

const {namedTypes: n, builders: b} = recast.types;

export default function injector(code, fileName, keys) {
  // Build an AST for a new program (the script setup content)
  const program = b.program([]);

  // 1. import { useFusion } from "__aliasedFusionPath__";
  const importUseFusion = b.importDeclaration(
    [b.importSpecifier(b.identifier("useFusion"), b.identifier("useFusion"))],
    b.literal("__aliasedFusionPath__")
  );

  // 2. import useHotFusion from "@fusion/vue/hmr";
  const importHotFusion = b.importDeclaration(
    [b.importDefaultSpecifier(b.identifier("useHotFusion"))],
    b.literal("@fusion/vue/hmr")
  );

  // 3. const __fusionData = useFusion([<keys>], __props.fusion);
  // Build an array expression with each key as an identifier.
  const keyIdentifiers = keys.map((key) => b.identifier(key));
  const arrayExpr = b.arrayExpression(keyIdentifiers);
  const fusionMemberExpr = b.memberExpression(b.identifier("__props"), b.identifier("fusion"));
  const callUseFusion = b.callExpression(b.identifier("useFusion"), [arrayExpr, fusionMemberExpr]);
  const declFusionData = b.variableDeclaration("const", [
    b.variableDeclarator(b.identifier("__fusionData"), callUseFusion),
  ]);

  // 4. const { key1, key2, ... } = __fusionData;
  const destructuringProperties = keys.map((key) =>
    b.property("init", b.identifier(key), b.identifier(key), false, true)
  );
  const destructuringDecl = b.variableDeclaration("const", [
    b.variableDeclarator(b.objectPattern(destructuringProperties), b.identifier("__fusionData")),
  ]);

  // 5. useHotFusion(__fusionData);
  const callHotFusion = b.callExpression(b.identifier("useHotFusion"), [b.identifier("__fusionData")]);
  const exprHotFusion = b.expressionStatement(callHotFusion);

  // Build the program body.
  program.body.push(importUseFusion, importHotFusion, declFusionData, destructuringDecl, exprHotFusion);

  // Generate the script setup block code.
  const generated = recast.print(program, {quote: "double"}).code;

  // Wrap the generated code in a <script setup> block.
  const scriptSetup = `<script setup>
${generated}
</script>`;

  // Append the script setup block to the original code.
  const outputCode = `${code}\n${scriptSetup}`;

  return {code: outputCode, map: null, remaining: []};
}

export {injector};