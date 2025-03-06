import {describe, expect, test} from "@jest/globals";
import {setupCodeMatcher} from "../shared.js";
import injector from "../../injectors/optionsWithoutSetupAst.js";

// Setup the custom matcher
setupCodeMatcher();

describe("injector", () => {
  test("handles code with no setup function", () => {
    const code = `
      import something from 'somewhere';
      export default {
        foo: 1
      }
    `;
    const keys = ["name", "email"];
    const result = injector(code, "test.js", keys);
    const expected = `
      import something from 'somewhere';
      import { useFusion } from "__aliasedFusionPath__";
      const __default__ = {
        foo: 1
      };
      __default__.setup = function(props) {
        return useFusion(["name", "email"], props.fusion);
      };
      export default __default__;
    `;
    expect(result.code).toMatchCode(expected);
  });

  test("handles code with no setup function and useFusion import present", () => {
    const code = `
      import { useFusion } from '@/lib/fusion';
      export default {
        bar: "test"
      }
    `;
    const keys = ["name", "email"];
    const result = injector(code, "test.js", keys);
    const expected = `
      import { useFusion } from "__aliasedFusionPath__";
      const __default__ = {
        bar: "test"
      };
      __default__.setup = function(props) {
        return useFusion(["name", "email"], props.fusion);
      };
      export default __default__;
    `;
    expect(result.code).toMatchCode(expected);
  });


  test("handles code with no setup function and aliased useFusion import present", () => {
    const code = `
      import { useFusion as uf } from '@/lib/fusion';
      export default {
        bar: "test"
      }
    `;
    const keys = ["name", "email"];
    const result = injector(code, "test.js", keys);
    const expected = `
      import { useFusion as uf } from "__aliasedFusionPath__";
      const __default__ = {
        bar: "test"
      };
      __default__.setup = function(props) {
        return uf(["name", "email"], props.fusion);
      };
      export default __default__;
    `;
    expect(result.code).toMatchCode(expected);
  });

  test("handles code with no setup function and extra whitespace", () => {
    const code = `
      import something from "somewhere";
      export default {
         foo: 42
      }
    `;
    const keys = ["name", "email"];
    const result = injector(code, "test.js", keys);
    const expected = `
      import something from "somewhere";
      import { useFusion } from "__aliasedFusionPath__";
      const __default__ = {
         foo: 42
      };
      __default__.setup = function(props) {
        return useFusion(["name", "email"], props.fusion);
      };
      export default __default__;
    `;
    expect(result.code).toMatchCode(expected);
  });

  test("handles code with no setup function and single-line default export", () => {
    const code = `import a from "b"; export default { a: 1 };`;
    const keys = ["name", "email"];
    const result = injector(code, "test.js", keys);
    const expected = `
      import a from "b";
      import { useFusion } from "__aliasedFusionPath__";
      const __default__ = { a: 1 };
      __default__.setup = function(props) {
        return useFusion(["name", "email"], props.fusion);
      };
      export default __default__;
    `;
    expect(result.code).toMatchCode(expected);
  });

  test("handles code with no setup function and default export spanning multiple lines", () => {
    const code = `
      import foo from "bar";
      export default {
        a: 1,
        b: 2
      }
    `;
    const keys = ["name", "email"];
    const result = injector(code, "test.js", keys);
    const expected = `
      import foo from "bar";
      import { useFusion } from "__aliasedFusionPath__";
      const __default__ = {
        a: 1,
        b: 2
      };
      __default__.setup = function(props) {
        return useFusion(["name", "email"], props.fusion);
      };
      export default __default__;
    `;
    expect(result.code).toMatchCode(expected);
  });

  test("handles code with no setup function and no existing imports", () => {
    const code = `
      export default { x: "y" };
    `;
    const keys = ["name", "email"];
    const result = injector(code, "test.js", keys);
    const expected = `
      import { useFusion } from "__aliasedFusionPath__";
      const __default__ = { x: "y" };
      __default__.setup = function(props) {
        return useFusion(["name", "email"], props.fusion);
      };
      export default __default__;
    `;
    expect(result.code).toMatchCode(expected);
  });

  test("handles code with no setup function and default export with comments", () => {
    const code = `
      // This is a default comment
      export default {
        // property comment
        x: 123 // inline comment
      };
    `;
    const keys = ["name", "email"];
    const result = injector(code, "test.js", keys);
    const expected = `
      import { useFusion } from "__aliasedFusionPath__";
      // This is a default comment
      const __default__ = {
        // property comment
        // inline comment
        x: 123 
      };
      __default__.setup = function(props) {
        return useFusion(["name", "email"], props.fusion);
      };
      export default __default__;
    `;
    expect(result.code).toMatchCode(expected);
  });

  test("handles code with no setup function and complex default export", () => {
    const code = `
      import { something } from "module";
      export default {
        a: 1,
        b: function() { return 2; },
        c: "hello"
      };
    `;
    const keys = ["name", "email"];
    const result = injector(code, "test.js", keys);
    const expected = `
      import { something } from "module";
      import { useFusion } from "__aliasedFusionPath__";
      const __default__ = {
        a: 1,
        b: function() { return 2; },
        c: "hello"
      };
      __default__.setup = function(props) {
        return useFusion(["name", "email"], props.fusion);
      };
      export default __default__;
    `;
    expect(result.code).toMatchCode(expected);
  });

  test("handles code with no setup function and default export with extra semicolons", () => {
    const code = `
      import foo from "bar";
      export default { z: 9 };;
    `;
    const keys = ["name", "email"];
    const result = injector(code, "test.js", keys);
    const expected = `
      import foo from "bar";
      import { useFusion } from "__aliasedFusionPath__";
      const __default__ = { z: 9 };
      __default__.setup = function(props) {
        return useFusion(["name", "email"], props.fusion);
      };
      export default __default__;
    `;
    expect(result.code).toMatchCode(expected);
  });

  test("handles code with no setup function and mixed quote types in default export", () => {
    const code = `
      import { something } from "somewhere";
      export default {
        a: 'hello',
        b: "world"
      };
    `;
    const keys = ["name", "email"];
    const result = injector(code, "test.js", keys);
    const expected = `
      import { something } from "somewhere";
      import { useFusion } from "__aliasedFusionPath__";
      const __default__ = {
        a: 'hello',
        b: "world"
      };
      __default__.setup = function(props) {
        return useFusion(["name", "email"], props.fusion);
      };
      export default __default__;
    `;
    expect(result.code).toMatchCode(expected);
  });
});