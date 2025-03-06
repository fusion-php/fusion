import {describe, expect, test} from "@jest/globals";
import {setupCodeMatcher} from "../shared.js";
import injector from "../../injectors/createScriptSetupAst.js";

// Setup the custom matcher
setupCodeMatcher();

describe("injector", () => {
  test("appends a script setup block to simple code", () => {
    const code = `console.log("Hello");`;
    const keys = ["name", "email"];
    const result = injector(code, "test.js", keys, "__aliasedFusionPath__", false);
    const expected = `
console.log("Hello");
<script setup>
import { useFusion } from "__aliasedFusionPath__";
import useHotFusion from "@fusion/vue/hmr";
const __fusionData = useFusion([name, email], __props.fusion);
const { name: name, email: email } = __fusionData;
useHotFusion(__fusionData);
</script>
    `;
    expect(result.code).toMatchCode(expected);
  });

  test("preserves existing HTML content and appends a script setup block", () => {
    const code = `
<div>Hello World</div>
<p>Test paragraph</p>
    `;
    const keys = ["user", "age"];
    const result = injector(code, "test.js", keys, "__aliasedFusionPath__", false);
    const expected = `
<div>Hello World</div>
<p>Test paragraph</p>
<script setup>
import { useFusion } from "__aliasedFusionPath__";
import useHotFusion from "@fusion/vue/hmr";
const __fusionData = useFusion([user, age], __props.fusion);
const { user: user, age: age } = __fusionData;
useHotFusion(__fusionData);
</script>
    `;
    expect(result.code).toMatchCode(expected);
  });

  test("handles empty code by injecting only the script setup block", () => {
    const code = ``;
    const keys = ["foo"];
    const result = injector(code, "test.js", keys, "__aliasedFusionPath__", false);
    const expected = `
<script setup>
import { useFusion } from "__aliasedFusionPath__";
import useHotFusion from "@fusion/vue/hmr";
const __fusionData = useFusion([foo], __props.fusion);
const { foo: foo } = __fusionData;
useHotFusion(__fusionData);
</script>
    `;
    expect(result.code).toMatchCode(expected);
  });

  test("appends a script setup block with multiple keys and preserves user code comments", () => {
    const code = `
/* User code start */
let a = 10;
/* User code end */
    `;
    const keys = ["first", "last", "email"];
    const result = injector(code, "test.js", keys, "__aliasedFusionPath__", false);
    const expected = `
/* User code start */
let a = 10;
/* User code end */
<script setup>
import { useFusion } from "__aliasedFusionPath__";
import useHotFusion from "@fusion/vue/hmr";
const __fusionData = useFusion([first, last, email], __props.fusion);
const { first: first, last: last, email: email } = __fusionData;
useHotFusion(__fusionData);
</script>
    `;
    expect(result.code).toMatchCode(expected);
  });

  test("supports custom fusion path", () => {
    const code = `console.log("Hello");`;
    const keys = ["name", "email"];
    const result = injector(code, "test.js", keys, "@custom/fusion-path", false);
    const expected = `
console.log("Hello");
<script setup>
import { useFusion } from "@custom/fusion-path";
import useHotFusion from "@fusion/vue/hmr";
const __fusionData = useFusion([name, email], __props.fusion);
const { name: name, email: email } = __fusionData;
useHotFusion(__fusionData);
</script>
    `;
    expect(result.code).toMatchCode(expected);
  });

  // TypeScript flag doesn't affect this injector much since it generates new code,
  // but including a test for completeness
  test("accepts typescript flag without changing behavior", () => {
    const code = `console.log("Hello");`;
    const keys = ["name", "email"];
    const result = injector(code, "test.js", keys, "__aliasedFusionPath__", true);
    const expected = `
console.log("Hello");
<script setup>
import { useFusion } from "__aliasedFusionPath__";
import useHotFusion from "@fusion/vue/hmr";
const __fusionData = useFusion([name, email], __props.fusion);
const { name: name, email: email } = __fusionData;
useHotFusion(__fusionData);
</script>
    `;
    expect(result.code).toMatchCode(expected);
  });
});