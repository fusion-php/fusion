import {describe, expect, test} from '@jest/globals';
import {setupCodeMatcher} from '../shared.js';
import optionsWithSetupAst from '../../injectors/optionsWithSetupAst.js';

setupCodeMatcher();

describe.only('optionsWithSetupAst', () => {
  test('handles code with no useFusion call', () => {
    const code = `
    import something from 'somewhere';
    export default {
      setup() {
        const x = 1;
      }
    }
    `;

    const result = optionsWithSetupAst(code, 'test.js', ['name', 'email']);

    const expected = `
let __fusionProvidedProps;
import something from 'somewhere';
import { useFusion } from "__aliasedFusionPath__";

const __default__ = {
  setup: function() {
    const x = 1;
  }
};


const userSetup = __default__.setup;
__default__.setup = function(props, ctx) {
  __fusionProvidedProps = props;
  const fusionData = useFusion(["name", "email"], props.fusion || {});
  let userReturns = typeof userSetup === "function" ? userSetup(props, ctx) : {};
  return { ...fusionData, ...userReturns };
};
export default __default__;
    `;

    expect(result.code).toMatchCode(expected);
  });

  test('handles code with useFusion import but no parameters', () => {
    const code = `
      import { useFusion } from '@/lib/fusion';
      export default {
        setup() {
          const { data } = useFusion();
        }
      }    
    `;

    const result = optionsWithSetupAst(code, 'test.js', ['name', 'email']);

    const expected = `
      import { useFusion } from "__aliasedFusionPath__";
      let __fusionProvidedProps;
      const __default__ = {
        setup: function() {
          const { data } = useFusion(["name", "email"], __fusionProvidedProps.fusion || {});
        }
      };
      
      const userSetup = __default__.setup;
      __default__.setup = function(props, ctx) {
        __fusionProvidedProps = props;
        const fusionData = {};
        let userReturns = typeof userSetup === "function" ? userSetup(props, ctx) : {};
        return { ...fusionData, ...userReturns };
      };
      export default __default__;     
    `;

    expect(result.code).toMatchCode(expected);
  });

  test('handles code with useFusion import and specific keys', () => {
    const code = `
      import { useFusion } from '@/lib/fusion';
      export default {
        setup() {
          const { data } = useFusion(['name']);
        }
      }       
    `;

    const result = optionsWithSetupAst(code, 'test.js', ['name', 'email']);

    const expected = `
import { useFusion } from "__aliasedFusionPath__";
let __fusionProvidedProps;    
const __default__ = {
  setup: function() {
    const { data } = useFusion(['name'], __fusionProvidedProps.fusion || {});
  }
};

const userSetup = __default__.setup;
__default__.setup = function(props, ctx) {
  __fusionProvidedProps = props;
  const fusionData = useFusion(["email"], props.fusion || {});
  let userReturns = typeof userSetup === "function" ? userSetup(props, ctx) : {};
  return { ...fusionData, ...userReturns };
};
export default __default__;    
    `;
    expect(result.code).toMatchCode(expected);
  });

  test('handles empty array parameter', () => {
    const code = `
      import { useFusion } from '@/lib/fusion';
      export default {
        setup() {
          const result = useFusion([]);
        }
      }   
    `;

    const result = optionsWithSetupAst(code, 'test.js', ['name', 'email']);

    // An empty array means no keys are handled, so all keys should be injected.
    const expected = `
import { useFusion } from "__aliasedFusionPath__";
let __fusionProvidedProps;    
const __default__ = {
  setup: function() {
    const result = useFusion([], __fusionProvidedProps.fusion || {});
  }
};

const userSetup = __default__.setup;
__default__.setup = function(props, ctx) {
  __fusionProvidedProps = props;
  const fusionData = useFusion(["name", "email"], props.fusion || {});
  let userReturns = typeof userSetup === "function" ? userSetup(props, ctx) : {};
  return { ...fusionData, ...userReturns };
};
export default __default__;    
    `;
    expect(result.code).toMatchCode(expected);
  });

  test('handles useFusion call with multiline parameter formatting', () => {
    const code = `
      import { useFusion } from '@/lib/fusion';
      export default {
        setup() {
          const { data } = useFusion([
            'name',
            'email'
          ]);
        }
      } 
    `;

    const result = optionsWithSetupAst(code, 'test.js', ['name', 'email', 'phone']);

    const expected = `
import { useFusion } from "__aliasedFusionPath__";
let __fusionProvidedProps;    
const __default__ = {
  setup: function() {
    const { data } = useFusion([ 'name', 'email' ], __fusionProvidedProps.fusion || {});
  }
};

const userSetup = __default__.setup;
__default__.setup = function(props, ctx) {
  __fusionProvidedProps = props;
  const fusionData = useFusion(["phone"], props.fusion || {});
  let userReturns = typeof userSetup === "function" ? userSetup(props, ctx) : {};
  return { ...fusionData, ...userReturns };
};
export default __default__;    
    `;
    expect(result.code).toMatchCode(expected);
  });

  test('handles useFusion import with other imports', () => {
    const code = `
      import { something } from 'somewhere';
      import { useFusion, otherThing } from '@/lib/fusion';
      import another from 'another-place';
      export default {
        setup() {
          const { data } = useFusion(['name']);
        }
      }
    `;

    const result = optionsWithSetupAst(code, 'test.js', ['name', 'email']);

    const expected = `
      let __fusionProvidedProps;
      import { something } from 'somewhere';
      import another from 'another-place';
      import { useFusion } from "__aliasedFusionPath__";
      
      const __default__ = {
        setup: function() {
          const { data } = useFusion(['name'], __fusionProvidedProps.fusion || {});
        }
      };
      
      const userSetup = __default__.setup;
      __default__.setup = function(props, ctx) {
        __fusionProvidedProps = props;
        const fusionData = useFusion(["email"], props.fusion || {});
        let userReturns = typeof userSetup === "function" ? userSetup(props, ctx) : {};
        return { ...fusionData, ...userReturns };
      };
      export default __default__;
    `;
    expect(result.code).toMatchCode(expected);
  });

  test('handles double quoted strings in useFusion parameters', () => {
    const code = `
      import { useFusion } from '@/lib/fusion';
      export default {
        setup() {
          const { data } = useFusion(["name"]);
        }
      }    
    `;

    const result = optionsWithSetupAst(code, 'test.js', ['name', 'email']);

    const expected = `
import { useFusion } from "__aliasedFusionPath__";
let __fusionProvidedProps;    
const __default__ = {
  setup: function() {
    const { data } = useFusion(["name"], __fusionProvidedProps.fusion || {});
  }
};

const userSetup = __default__.setup;
__default__.setup = function(props, ctx) {
  __fusionProvidedProps = props;
  const fusionData = useFusion(["email"], props.fusion || {});
  let userReturns = typeof userSetup === "function" ? userSetup(props, ctx) : {};
  return { ...fusionData, ...userReturns };
};
export default __default__;
    `;
    expect(result.code).toMatchCode(expected);
  });

  test('handles mixed quote types in parameters', () => {
    const code = `
      import { useFusion } from '@/lib/fusion';
      export default {
        setup() {
          const { data } = useFusion(['name', "email"]);
        }
      }     
    `;

    const result = optionsWithSetupAst(code, 'test.js', ['name', 'email', 'phone']);

    const expected = `
      import { useFusion } from "__aliasedFusionPath__";
      let __fusionProvidedProps;
      const __default__ = {
        setup: function() {
          const { data } = useFusion(['name', "email"], __fusionProvidedProps.fusion || {});
        }
      };
      
      const userSetup = __default__.setup;
      __default__.setup = function(props, ctx) {
        __fusionProvidedProps = props;
        const fusionData = useFusion(["phone"], props.fusion || {});
        let userReturns = typeof userSetup === "function" ? userSetup(props, ctx) : {};
        return { ...fusionData, ...userReturns };
      };
      export default __default__;
    `;
    expect(result.code).toMatchCode(expected);
  });

  test('handles useFusion call with trailing comma in parameters', () => {
    const code = `
      import { useFusion } from '@/lib/fusion';
      export default {
        setup() {
          const data = useFusion(['name',]);
        }
      }      
    `;

    const result = optionsWithSetupAst(code, 'test.js', ['name', 'email']);

    // The trailing comma should be preserved.
    const expected = `
import { useFusion } from "__aliasedFusionPath__";
let __fusionProvidedProps;    
const __default__ = {
  setup: function() {
    const data = useFusion(['name',], __fusionProvidedProps.fusion || {});
  }
};

const userSetup = __default__.setup;
__default__.setup = function(props, ctx) {
  __fusionProvidedProps = props;
  const fusionData = useFusion(["email"], props.fusion || {});
  let userReturns = typeof userSetup === "function" ? userSetup(props, ctx) : {};
  return { ...fusionData, ...userReturns };
};
export default __default__;    
    `;
    expect(result.code).toMatchCode(expected);
  });

  // test('throws error if useFusion is imported with an alias', () => {
  //   const code = `
  //     import { useFusion as uf } from '@/lib/fusion';
  //     const data = uf(['name']);
  //   `;
  //   const script = makeBlock(code);
  //   const keys = ['name', 'email'];
  //
  //   expect(() => optionsWithSetupAst(code, script, keys)).toThrow("Aliased useFusion import is not allowed.");
  // });

  // test('throws error if useFusion is called twice', () => {
  //   const code = `
  //     import { useFusion } from '@/lib/fusion';
  //     const a = useFusion(['name']);
  //     const b = useFusion(['email']);
  //   `;
  //   const script = makeBlock(code);
  //   const keys = ['name', 'email', 'phone'];
  //
  //   expect(() => optionsWithSetupAst(code, script, keys)).toThrow("Multiple useFusion calls are not allowed.");
  // });

  test('import lname only', () => {
    const code = `
      import {useFusion} from "$fusion/Pages/Imports/ScriptSetup.js";
      
      export default {
        setup() {
          const {lname} = useFusion(['lname']);
      
          lname.value = 'Smith';
      
          return {lname}
        }
      }    
    `;

    const result = optionsWithSetupAst(code, 'test.js', ['fname', 'lname']);

    const expected = `
import { useFusion } from "__aliasedFusionPath__";
let __fusionProvidedProps;

const __default__ = {
  setup: function() {
    const {lname} = useFusion(['lname'], __fusionProvidedProps.fusion || {});
    lname.value = 'Smith';
    return {lname}
  }
};

const userSetup = __default__.setup;
__default__.setup = function(props, ctx) {
  __fusionProvidedProps = props;
  const fusionData = useFusion(["fname"], props.fusion || {});
  let userReturns = typeof userSetup === "function" ? userSetup(props, ctx) : {};
  return { ...fusionData, ...userReturns };
};
export default __default__;    
    `;
    expect(result.code).toMatchCode(expected);
  })


  test('user imported it all', () => {
    const code = `
      import {useFusion} from "$fusion/Pages/Imports/ScriptSetup.js";
      
      export default {
        setup() {
          const {lname} = useFusion(['lname']);
          return {lname}
        }
      }    
    `;

    const result = optionsWithSetupAst(code, 'test.js', ['lname']);

    const expected = `
import { useFusion } from "__aliasedFusionPath__";
let __fusionProvidedProps;

const __default__ = {
  setup: function() {
    const {lname} = useFusion(['lname'], __fusionProvidedProps.fusion || {});
    return {lname}
  }
};

const userSetup = __default__.setup;
__default__.setup = function(props, ctx) {
  __fusionProvidedProps = props;
  const fusionData = {};
  let userReturns = typeof userSetup === "function" ? userSetup(props, ctx) : {};
  return { ...fusionData, ...userReturns };
};
export default __default__;    
    `;
    expect(result.code).toMatchCode(expected);
  })

});